import { CommonModule } from '@angular/common';
import { Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ACTION_CATALOG, CombatTurn, HitResult, TurnType } from '@shared/domain';
import { RosharIconComponent } from '../../shared/roshar-icon.component';
import { actionIcon, resultIcon } from '../../shared/roshar-icons';
import { CombatStore } from './combat.store';

@Component({
  selector: 'app-combat-tracker-page',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, RosharIconComponent],
  template: `
    @if (store.combat()) {
      <section class="page-header combat-command-bar card engraved-panel">
        <div class="combat-command-copy">
          <p class="eyebrow">Combat tracker</p>
          <h2>{{ store.combat()!.title }}</h2>
          <p>{{ store.combat()!.status }} combat with {{ store.combat()!.participants.length }} participants. Keep the board live and the command slab focused on the current turn.</p>
        </div>
        <div class="combat-command-side">
          <div class="combat-command-stats">
            <article class="route-stat sapphire">
              <app-roshar-icon key="sessions" label="Participants" tone="sapphire" [size]="18" />
              <span class="stat-label">Participants</span>
              <strong>{{ store.combat()!.participants.length }}</strong>
            </article>
            <article class="route-stat topaz">
              <app-roshar-icon key="fast" label="Round" tone="topaz" [size]="18" />
              <span class="stat-label">Round</span>
              <strong>{{ store.combat()!.currentRoundNumber || 1 }}</strong>
            </article>
            <article class="route-stat ruby">
              <app-roshar-icon key="chronicle" label="Entries" tone="ruby" [size]="18" />
              <span class="stat-label">Chronicle</span>
              <strong>{{ chronicleEntries().length }}</strong>
            </article>
          </div>
          <div class="button-row combat-command-actions">
            <button type="button" (click)="startCombat()">Start combat</button>
            <button type="button" class="button-outline" (click)="openRoundPlanner()">Next round</button>
            <button type="button" class="button-outline" (click)="finishCombat()">Finish combat</button>
            <a [routerLink]="['/sessions', store.combat()!.sessionId, 'combats', store.combat()!.id, 'summary']" class="button-outline">Summary</a>
          </div>
        </div>
      </section>

      <div class="combat-layout tactical-war-table">
        <aside class="card engraved-panel combat-sidebar" data-tour="combat-participants">
          <div class="card-header">
            <div class="section-heading">
              <app-roshar-icon key="sessions" label="Participants" tone="sapphire" [size]="18" />
              <h3>Unit ledger</h3>
            </div>
            <span class="pill">Round {{ store.combat()!.currentRoundNumber || 1 }}</span>
          </div>
          <div class="list-stack">
            @for (participant of store.combat()!.participants; track participant.id) {
              <article class="participant-ledger" [class.active]="selectedParticipantId() === participant.id" [class.enemy-ledger]="participant.side === 'enemy' || participant.side === 'npc'">
                <button class="list-item-button participant-ledger-button" type="button" (click)="selectedParticipantId.set(participant.id)">
                  <div>
                    <strong class="event-line">
                      <app-roshar-icon key="sessions" [label]="participant.name" [tone]="participantTone(participant.side)" [size]="16" />
                      {{ participant.name }}
                    </strong>
                    <small>{{ participant.side }}</small>
                  </div>
                  <div class="participant-resources">
                    <span class="tag-chip">
                      <app-roshar-icon key="health" label="Health" tone="ruby" [size]="14" />
                      {{ participant.currentHealth ?? '-' }}
                    </span>
                    <span class="tag-chip">
                      <app-roshar-icon key="focus" label="Focus" tone="topaz" [size]="14" />
                      {{ participant.currentFocus }}
                    </span>
                  </div>
                </button>
                <div class="mini-adjusters sidebar-resource-rail">
                  <button type="button" class="button-outline micro-button" (click)="adjustHealth(participant.id, -1, 'Quick sidebar damage')">-1 HP</button>
                  <button type="button" class="button-outline micro-button" (click)="adjustFocus(participant.id, -1)">-1 F</button>
                </div>
              </article>
            }
          </div>
        </aside>

        <section class="card engraved-panel combat-board" data-tour="combat-turn-groups">
          <div class="card-header">
            <div class="section-heading">
              <app-roshar-icon key="combat" label="Turn groups" tone="ruby" [size]="18" />
              <h3>Tactical board</h3>
            </div>
            <span class="pill">{{ store.combat()!.turns.length }} turns</span>
          </div>
          <div class="turn-legend">
            <span class="tag-chip">
              <app-roshar-icon key="fast" label="Fast turn" tone="topaz" [size]="14" />
              Fast turn
            </span>
            <span class="tag-chip">
              <app-roshar-icon key="slow" label="Slow turn" tone="sapphire" [size]="14" />
              Slow turn
            </span>
            <span class="tag-chip">
              <app-roshar-icon key="reaction" label="Reaction" tone="emerald" [size]="14" />
              Reaction ready
            </span>
          </div>
          <div class="turn-group-grid">
            @for (group of groupedRounds(); track group.label) {
              <section class="inset-panel tactical-group">
                <div class="section-heading">
                  <app-roshar-icon [key]="groupIcon(group.label)" [label]="group.label" [tone]="groupTone(group.label)" [size]="16" />
                  <h3>{{ group.label }}</h3>
                </div>
                <div class="list-stack">
                  @for (turn of group.turns; track turn.id) {
                    <button
                      class="list-item-button tactical-turn"
                      type="button"
                      [class.active]="selectedTurnId() === turn.id"
                      [class.turn-complete]="turn.actionsUsed >= turn.actionsAvailable"
                      [class.turn-partial]="turn.actionsUsed > 0 && turn.actionsUsed < turn.actionsAvailable"
                      (click)="selectTurn(turn)"
                    >
                      <div>
                        <strong>{{ participantName(turn.participantId) }}</strong>
                        <small class="event-line">
                          <app-roshar-icon [key]="turn.turnType === 'fast' ? 'fast' : 'slow'" [label]="turn.turnType" [tone]="turn.turnType === 'fast' ? 'topaz' : 'sapphire'" [size]="14" />
                          {{ turn.turnType }} turn
                        </small>
                      </div>
                      <div class="turn-meta">
                        <span>{{ turn.actionsUsed }}/{{ turn.actionsAvailable }} actions</span>
                        <span class="tag-chip">
                          <app-roshar-icon key="reaction" label="Reaction" [tone]="turn.reactionUsed ? 'ruby' : 'emerald'" [size]="14" />
                          {{ turn.reactionUsed ? 'Spent' : 'Ready' }}
                        </span>
                      </div>
                    </button>
                  }
                </div>
              </section>
            }
          </div>
        </section>

        <div class="combat-command-column">
          <section class="card engraved-panel combat-console" data-tour="combat-action-logger">
            <div class="card-header">
              <div class="section-heading">
                <app-roshar-icon key="combat" label="Quick action logger" tone="gold" [size]="18" />
                <h3>Command slab</h3>
              </div>
              <div class="ledger-meta">
                @if (roundStatus()) {
                  <span class="pill emphasis-pill">{{ roundStatus() }}</span>
                }
                <span class="pill">{{ selectedTurn()?.turnType || 'Select turn' }}</span>
              </div>
            </div>

            @if (selectedTurn()) {
              <div class="quick-action-ribbon">
                @for (item of pinnedActions(); track item!.key; let index = $index) {
                  <button type="button" class="button-outline shell-shortcut" [class.active]="actionForm.controls.actionType.value === item!.key" (click)="selectPinnedAction(item!.key)">
                    <app-roshar-icon [key]="item!.key" [label]="item!.name" tone="gold" [size]="15" />
                    <span>{{ index + 1 }}. {{ item!.name }}</span>
                  </button>
                }
              </div>
              <div class="hotkey-hints">
                <span class="tag-chip">1-6 action</span>
                <span class="tag-chip">Enter log</span>
                <span class="tag-chip">R reaction</span>
                <span class="tag-chip">N round plan</span>
              </div>

              <div class="selected-turn-summary">
                <div>
                  <span class="stat-label">Selected combatant</span>
                  <strong class="event-line">
                    <app-roshar-icon key="sessions" [label]="selectedParticipant()?.name || 'Selected combatant'" [tone]="selectedParticipant() ? participantTone(selectedParticipant()!.side) : 'muted'" [size]="16" />
                    {{ selectedParticipant()?.name }}
                  </strong>
                </div>
                <div>
                  <span class="stat-label">Conditions</span>
                  <p class="event-line">
                    <app-roshar-icon key="condition" label="Conditions" tone="emerald" [size]="14" />
                    {{ selectedParticipant()?.conditions?.join(', ') || 'None active' }}
                  </p>
                  <div class="compact-button-row">
                    @for (condition of selectedParticipant()?.conditions || []; track condition) {
                      <button type="button" class="button-outline micro-button" (click)="removeCondition(selectedParticipant()!.id, condition)">{{ condition }} ×</button>
                    }
                  </div>
                </div>
                <div>
                  <span class="stat-label">Resources</span>
                  <p class="event-line">
                    <app-roshar-icon key="health" label="Health" tone="ruby" [size]="14" />
                    {{ selectedParticipant()?.currentHealth ?? '-' }} HP
                    <app-roshar-icon key="focus" label="Focus" tone="topaz" [size]="14" />
                    {{ selectedParticipant()?.currentFocus }} focus
                  </p>
                  <div class="resource-rail">
                    <button type="button" class="button-outline micro-button" (click)="adjustHealth(selectedParticipant()!.id, -5)">-5 HP</button>
                    <button type="button" class="button-outline micro-button" (click)="adjustHealth(selectedParticipant()!.id, -1)">-1 HP</button>
                    <button type="button" class="button-outline micro-button" (click)="adjustHealth(selectedParticipant()!.id, 1, 'Healing')">+1 HP</button>
                    <button type="button" class="button-outline micro-button" (click)="adjustHealth(selectedParticipant()!.id, 5, 'Healing')">+5 HP</button>
                    <button type="button" class="button-outline micro-button" (click)="adjustFocus(selectedParticipant()!.id, -1)">-1 Focus</button>
                    <button type="button" class="button-outline micro-button" (click)="adjustFocus(selectedParticipant()!.id, 1)">+1 Focus</button>
                  </div>
                </div>
              </div>

              @if (selectedEnemySheet()) {
                <section class="enemy-sheet-panel inset-panel">
                  <div class="card-header compact-card-header">
                    <div class="section-heading">
                      <app-roshar-icon key="chronicle" label="Enemy sheet" tone="topaz" [size]="18" />
                      <h3>{{ selectedEnemySheet()!.title }} sheet</h3>
                    </div>
                    <button type="button" class="button-outline micro-button" (click)="openEnemySheet()">Open full image</button>
                  </div>
                  <button type="button" class="enemy-sheet-preview" [style.background-image]="'url(' + selectedEnemySheet()!.imagePath + ')'" (click)="openEnemySheet()"></button>
                </section>
              }

              <div class="condition-manager">
                <label class="compact-field">
                  <span>Add condition</span>
                  <input [formControl]="conditionForm.controls.conditionName" type="text" placeholder="Dazed, Prone, Marked..." />
                </label>
                <button type="button" class="button-outline shell-shortcut" (click)="addCondition()">
                  <app-roshar-icon key="condition" label="Add condition" tone="emerald" [size]="15" />
                  <span>Add condition</span>
                </button>
                <div class="condition-quick-chips">
                  @for (condition of commonConditions; track condition) {
                    <button type="button" class="button-outline micro-button" (click)="setConditionName(condition)">{{ condition }}</button>
                  }
                </div>
              </div>

              <div class="action-toggle-row">
                <button type="button" class="button-outline micro-button" [class.active]="actionForm.controls.useTarget.value" [disabled]="selectedActionMeta()?.requiresTarget" (click)="toggleField('useTarget')">
                  {{ selectedActionMeta()?.requiresTarget ? 'Target required' : actionForm.controls.useTarget.value ? 'Target on' : 'Add target' }}
                </button>
                <button type="button" class="button-outline micro-button" [class.active]="actionForm.controls.useRoll.value" [disabled]="selectedActionMeta()?.requiresRoll" (click)="toggleField('useRoll')">
                  {{ selectedActionMeta()?.requiresRoll ? 'Test required' : actionForm.controls.useRoll.value ? 'Test on' : 'Enable test' }}
                </button>
                <button type="button" class="button-outline micro-button" [class.active]="actionForm.controls.trackDamage.value" [disabled]="selectedActionMeta()?.supportsDamage" (click)="toggleField('trackDamage')">
                  {{ selectedActionMeta()?.supportsDamage ? 'Damage required' : actionForm.controls.trackDamage.value ? 'Damage on' : 'Track damage' }}
                </button>
                <span class="tag-chip">{{ selectedActionMeta()?.defaultFocusCost || 0 }} default focus</span>
              </div>

              <div class="action-focus-card">
                <div>
                  <span class="stat-label">Selected action</span>
                  <strong class="event-line">
                    <app-roshar-icon [key]="selectedActionDescriptor().key" [label]="selectedActionDescriptor().label" [tone]="selectedActionDescriptor().tone || 'gold'" [size]="18" />
                    {{ selectedActionDescriptor().label }}
                  </strong>
                </div>
                <div class="action-focus-meta">
                  <span class="tag-chip">{{ selectedActionMeta()?.type || 'action' }}</span>
                  <span class="tag-chip">{{ selectedActionMeta()?.defaultActionCost || 0 }} action cost</span>
                  <span class="tag-chip">{{ selectedActionMeta()?.defaultFocusCost || 0 }} focus</span>
                </div>
              </div>

              <form class="form-grid combat-action-form" [formGroup]="actionForm" (ngSubmit)="logAction()">
                <label>
                  <span>Action</span>
                  <select formControlName="actionType">
                    @for (item of actionCatalog; track item.key) {
                      <option [value]="item.key">{{ item.name }}</option>
                    }
                  </select>
                </label>
                @if (showTargetField()) {
                  <label>
                    <span>Target</span>
                    <select formControlName="targetId">
                      <option value="">No target</option>
                      @for (participant of availableTargets(); track participant.id) {
                        <option [value]="participant.id">{{ participant.name }}</option>
                      }
                    </select>
                  </label>
                }
                <label>
                  <span>Result</span>
                  <select formControlName="hitResult">
                    <option value="neutral">Neutral</option>
                    <option value="hit">Hit</option>
                    <option value="graze">Graze</option>
                    <option value="miss">Miss</option>
                    <option value="criticalHit">Critical hit</option>
                    <option value="criticalMiss">Critical miss</option>
                    <option value="support">Support</option>
                  </select>
                </label>
                <label>
                  <span>Focus cost</span>
                  <input formControlName="focusCost" type="number" min="0" />
                </label>
                @if (showRollField()) {
                  <label>
                    <span>d20 test</span>
                    <input formControlName="rawD20" type="number" min="1" max="20" />
                  </label>
                  <label>
                    <span>Modifier</span>
                    <input formControlName="modifier" type="number" />
                  </label>
                }
                @if (showDamageField()) {
                  <label>
                    <span>Damage</span>
                    <input formControlName="damageAmount" type="number" min="0" />
                  </label>
                }
                @if (showRollField()) {
                  <div class="full-width exact-d20-panel">
                    <div class="section-heading">
                      <app-roshar-icon key="rolls" label="Exact d20 result" tone="topaz" [size]="16" />
                      <h3>Exact d20 result</h3>
                    </div>
                    <p>Enter the exact raw d20, or tap the quick grid during fast play.</p>
                    <div class="exact-d20-row compact-d20-grid">
                      @for (value of quickD20Values; track value) {
                        <button type="button" class="button-outline micro-button" [class.active]="actionForm.controls.rawD20.value === value" [class.edge-roll]="value === 1 || value === 20" (click)="setActionRawD20(value)">
                          {{ value }}
                        </button>
                      }
                    </div>
                  </div>
                }
                <label class="full-width">
                  <span>Note</span>
                  <textarea formControlName="note" rows="2"></textarea>
                </label>
                <div class="button-row full-width">
                  <button type="submit">Log action</button>
                  <button type="button" class="button-outline" (click)="markReaction()">Use reaction</button>
                </div>
              </form>
            } @else {
              <article class="empty-card">Select a turn to log actions.</article>
            }
          </section>

          <section class="card engraved-panel chronicle-feed combat-feed-panel" data-tour="combat-feed">
            <div class="card-header">
              <div class="section-heading">
                <app-roshar-icon key="chronicle" label="Combat event feed" tone="topaz" [size]="18" />
                <h3>Battle chronicle</h3>
              </div>
              <span class="pill">{{ chronicleEntries().length }}</span>
            </div>
            <div class="list-stack">
              @for (entry of chronicleEntries(); track entry.id) {
                <article class="timeline-item chronicle-entry" [class.resource-entry]="entry.category !== 'action'">
                  <strong class="event-line">
                    <app-roshar-icon [key]="entry.icon.key" [label]="entry.icon.label" [tone]="entryTone(entry.icon.tone)" [size]="16" />
                    {{ entry.title }}
                  </strong>
                  <p class="event-line">
                    @if (entry.result) {
                      <app-roshar-icon [key]="entry.result.key" [label]="entry.result.label" [tone]="entryTone(entry.result.tone)" [size]="14" />
                    }
                    {{ entry.detail }}
                  </p>
                  <small>{{ entry.timestamp | date: 'short' }} • {{ entry.note }}</small>
                  @if (entry.category === 'action') {
                    <div class="compact-button-row chronicle-actions">
                      <button type="button" class="button-outline micro-button" (click)="revertAction(entry.id)">Undo</button>
                    </div>
                  }
                </article>
              } @empty {
                <article class="empty-card">No actions in the chronicle yet. Select a turn and log the first move to wake the board.</article>
              }
            </div>
          </section>
        </div>
      </div>

      @if (roundPlannerOpen()) {
        <div class="confirm-modal-backdrop" (click)="closeRoundPlanner()"></div>
        <section class="confirm-modal card engraved-panel round-planner-modal">
          <div class="card-header">
            <div class="section-heading">
              <app-roshar-icon key="fast" label="Round planner" tone="topaz" [size]="18" />
              <h3>Plan next round</h3>
            </div>
          </div>
          <p class="muted">Choose Fast or Slow for each combatant before creating the next round.</p>
          <div class="list-stack">
            @for (group of plannerGroups(); track group.label) {
              <section class="inset-panel">
                <div class="section-heading">
                  <app-roshar-icon [key]="group.tone === 'ruby' ? 'combat' : 'sessions'" [label]="group.label" [tone]="group.tone" [size]="16" />
                  <h3>{{ group.label }}</h3>
                </div>
                <div class="round-planner-list">
                  @for (participant of group.entries; track participant.id) {
                    <article class="round-planner-row">
                      <strong>{{ participant.name }}</strong>
                      <div class="tempo-toggle">
                        <button type="button" class="button-outline micro-button" [class.active]="plannerTempo(participant.id) === 'fast'" (click)="setPlannerTempo(participant.id, 'fast')">Fast</button>
                        <button type="button" class="button-outline micro-button" [class.active]="plannerTempo(participant.id) === 'slow'" (click)="setPlannerTempo(participant.id, 'slow')">Slow</button>
                      </div>
                    </article>
                  }
                </div>
              </section>
            }
          </div>
          <div class="button-row">
            <button type="button" class="button-outline" (click)="closeRoundPlanner()">Cancel</button>
            <button type="button" (click)="createNextRound()">Create next round</button>
          </div>
        </section>
      }
    } @else {
      <section class="card empty-card">Loading combat...</section>
    }
  `,
})
export class CombatTrackerPageComponent {
  readonly store = inject(CombatStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  readonly combatId = signal('');
  readonly actionCatalog = ACTION_CATALOG;
  readonly pinnedActionKeys = ['strike', 'move', 'aid', 'dodge', 'recover', 'custom'];
  readonly quickD20Values = Array.from({ length: 20 }, (_, index) => index + 1);
  readonly commonConditions = ['Dazed', 'Prone', 'Marked', 'Inspired', 'Bleeding'];
  readonly selectedTurnId = signal('');
  readonly selectedParticipantId = signal('');
  readonly roundStatus = signal('');
  readonly roundPlannerOpen = signal(false);
  readonly roundPlannerAssignments = signal<Record<string, TurnType>>({});
  readonly selectedTurn = computed(
    () => this.store.combat()?.turns.find((turn) => turn.id === this.selectedTurnId()) ?? null,
  );
  readonly selectedParticipant = computed(
    () =>
      this.store
        .combat()
        ?.participants.find(
          (participant) => participant.id === this.selectedParticipantId() || participant.id === this.selectedTurn()?.participantId,
        ) ?? null,
  );
  readonly selectedEnemySheet = computed(() => {
    const participant = this.selectedParticipant();
    if (!participant || (participant.side !== 'enemy' && participant.side !== 'npc') || !participant.imagePath) {
      return null;
    }
    return {
      title: participant.name,
      imagePath: participant.imagePath,
    };
  });
  readonly availableTargets = computed(
    () => this.store.combat()?.participants.filter((participant) => participant.id !== this.selectedTurn()?.participantId) ?? [],
  );
  readonly groupedRounds = computed(() => {
    const combat = this.store.combat();
    if (!combat) {
      return [];
    }
    const round = combat.rounds.at(-1);
    if (!round) {
      return [];
    }
    return [
      { label: 'Fast PCs', turns: this.turnsForGroup(round.fastPCIds, round.id) },
      { label: 'Fast NPCs', turns: this.turnsForGroup(round.fastNPCIds, round.id) },
      { label: 'Slow PCs', turns: this.turnsForGroup(round.slowPCIds, round.id) },
      { label: 'Slow NPCs', turns: this.turnsForGroup(round.slowNPCIds, round.id) },
    ];
  });
  readonly plannerGroups = computed(() => {
    const combat = this.store.combat();
    if (!combat) {
      return [];
    }
    return [
      {
        label: 'Players and allies',
        tone: 'sapphire' as const,
        entries: combat.participants.filter((participant) => participant.side === 'pc' || participant.side === 'ally'),
      },
      {
        label: 'NPCs and enemies',
        tone: 'ruby' as const,
        entries: combat.participants.filter((participant) => participant.side === 'npc' || participant.side === 'enemy'),
      },
    ].filter((group) => group.entries.length);
  });
  readonly chronicleEntries = computed(() => {
    const combat = this.store.combat();
    if (!combat) {
      return [];
    }

    const actionEntries = combat.actionEvents.map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      category: 'action' as const,
      icon: this.actionDescriptor(event.actionType),
      result: this.resultDescriptor(event.hitResult),
      title: `${this.participantName(event.actorId)} used ${this.actionName(event.actionType)}`,
      detail: `${event.hitResult || 'neutral'} • damage ${event.damageAmount || 0} • focus ${event.focusCost}`,
      note: event.note || 'No note',
    }));

    const healthEntries = combat.healthEvents.map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      category: 'resource' as const,
      icon: { key: 'health', label: 'Health adjustment', tone: event.delta < 0 ? 'ruby' : 'emerald' },
      result: undefined,
      title: `${this.participantName(event.participantId)} ${event.delta < 0 ? 'lost' : 'gained'} ${Math.abs(event.delta)} HP`,
      detail: event.reason,
      note: 'Health change',
    }));

    const focusEntries = combat.focusEvents.map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      category: 'resource' as const,
      icon: { key: 'focus', label: 'Focus adjustment', tone: event.delta < 0 ? 'topaz' : 'emerald' },
      result: undefined,
      title: `${this.participantName(event.participantId)} ${event.delta < 0 ? 'spent' : 'gained'} ${Math.abs(event.delta)} focus`,
      detail: event.reason,
      note: 'Focus change',
    }));

    const conditionEntries = combat.conditionEvents.map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      category: 'resource' as const,
      icon: { key: 'condition', label: 'Condition update', tone: event.operation === 'add' ? 'emerald' : 'muted' },
      result: undefined,
      title: `${this.participantName(event.participantId)} ${event.operation === 'add' ? 'gained' : 'lost'} ${event.conditionName}`,
      detail: event.note || 'Condition update',
      note: 'Condition change',
    }));

    return [...actionEntries, ...healthEntries, ...focusEntries, ...conditionEntries]
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
      .slice(0, 40);
  });

  readonly actionForm = this.fb.nonNullable.group({
    actionType: ['strike'],
    useTarget: [true],
    useRoll: [true],
    trackDamage: [true],
    targetId: [''],
    rawD20: [10],
    modifier: [0],
    hitResult: ['neutral' as HitResult],
    damageAmount: [0],
    focusCost: [0],
    note: [''],
  });
  readonly conditionForm = this.fb.nonNullable.group({
    conditionName: [''],
  });

  constructor() {
    const sub = this.route.paramMap.subscribe((params) => {
      const combatId = params.get('combatId');
      if (combatId) {
        this.combatId.set(combatId);
        void this.store.loadCombat(combatId).then(() => {
          const turn = this.store.combat()?.turns[0];
          if (turn) {
            this.selectTurn(turn);
          }
        });
      }
    });
    const actionSub = this.actionForm.controls.actionType.valueChanges.subscribe((actionType) => {
      this.applyActionDefaults(actionType);
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
    this.destroyRef.onDestroy(() => actionSub.unsubscribe());
  }

  participantName(participantId: string): string {
    return this.store.combat()?.participants.find((participant) => participant.id === participantId)?.name ?? 'Unknown';
  }

  actionName(actionType: string): string {
    return this.actionCatalog.find((entry) => entry.key === actionType)?.name ?? actionType;
  }

  pinnedActions() {
    return this.pinnedActionKeys.map((key) => this.actionCatalog.find((entry) => entry.key === key)).filter(Boolean);
  }

  actionDescriptor(actionType: string) {
    return actionIcon(actionType, this.actionName(actionType));
  }

  selectedActionDescriptor() {
    return this.actionDescriptor(this.actionForm.controls.actionType.value);
  }

  selectedActionMeta() {
    return this.actionCatalog.find((entry) => entry.key === this.actionForm.controls.actionType.value) ?? null;
  }

  showTargetField(): boolean {
    const meta = this.selectedActionMeta();
    return Boolean(meta?.requiresTarget || this.actionForm.controls.useTarget.value);
  }

  showRollField(): boolean {
    const meta = this.selectedActionMeta();
    return Boolean(meta?.requiresRoll || this.actionForm.controls.useRoll.value);
  }

  showDamageField(): boolean {
    const meta = this.selectedActionMeta();
    return Boolean(meta?.supportsDamage || this.actionForm.controls.trackDamage.value);
  }

  resultDescriptor(result: string | undefined) {
    return resultIcon(result);
  }

  entryTone(tone: string | undefined) {
    switch (tone) {
      case 'default':
      case 'gold':
      case 'sapphire':
      case 'emerald':
      case 'ruby':
      case 'topaz':
      case 'muted':
        return tone;
      default:
        return 'muted';
    }
  }

  participantTone(side: string) {
    return side === 'enemy' || side === 'npc' ? 'ruby' : 'sapphire';
  }

  groupIcon(label: string): string {
    return label.startsWith('Fast') ? 'fast' : 'slow';
  }

  groupTone(label: string) {
    if (label.startsWith('Fast')) {
      return 'topaz';
    }
    return label.includes('NPC') ? 'ruby' : 'sapphire';
  }

  selectTurn(turn: CombatTurn): void {
    this.selectedTurnId.set(turn.id);
    this.selectedParticipantId.set(turn.participantId);
    this.roundStatus.set('');
  }

  async startCombat(): Promise<void> {
    await this.store.startCombat(this.combatId());
  }

  async finishCombat(): Promise<void> {
    await this.store.finishCombat(this.combatId());
  }

  openRoundPlanner(): void {
    const combat = this.store.combat();
    const previous = combat?.rounds.at(-1);
    if (!combat || !previous) {
      return;
    }
    const assignments: Record<string, TurnType> = {};
    for (const participant of combat.participants) {
      assignments[participant.id] =
        previous.fastPCIds.includes(participant.id) || previous.fastNPCIds.includes(participant.id) ? 'fast' : 'slow';
    }
    this.roundPlannerAssignments.set(assignments);
    this.roundPlannerOpen.set(true);
  }

  closeRoundPlanner(): void {
    this.roundPlannerOpen.set(false);
  }

  plannerTempo(participantId: string): TurnType {
    return this.roundPlannerAssignments()[participantId] ?? 'slow';
  }

  setPlannerTempo(participantId: string, tempo: TurnType): void {
    this.roundPlannerAssignments.update((items) => ({ ...items, [participantId]: tempo }));
  }

  async createNextRound(): Promise<void> {
    const combat = this.store.combat();
    if (!combat) {
      return;
    }
    const assignments = this.roundPlannerAssignments();
    const fastPCIds: string[] = [];
    const fastNPCIds: string[] = [];
    const slowPCIds: string[] = [];
    const slowNPCIds: string[] = [];

    for (const participant of combat.participants) {
      const tempo = assignments[participant.id] ?? 'slow';
      if (tempo === 'fast') {
        if (participant.side === 'pc' || participant.side === 'ally') {
          fastPCIds.push(participant.id);
        } else {
          fastNPCIds.push(participant.id);
        }
      } else if (participant.side === 'pc' || participant.side === 'ally') {
        slowPCIds.push(participant.id);
      } else {
        slowNPCIds.push(participant.id);
      }
    }
    await this.store.createRound(this.combatId(), {
      fastPCIds,
      fastNPCIds,
      slowPCIds,
      slowNPCIds,
    });
    this.roundPlannerOpen.set(false);
    const nextTurn = this.store.combat()?.turns.find((turn) => turn.roundId === this.store.combat()?.rounds.at(-1)?.id);
    if (nextTurn) {
      this.selectTurn(nextTurn);
    }
  }

  async logAction(): Promise<void> {
    const turn = this.selectedTurn();
    const combat = this.store.combat();
    if (!turn || !combat) {
      return;
    }

    const round = combat.rounds.find((entry) => entry.id === turn.roundId);
    const raw = this.actionForm.getRawValue();
    const actor = combat.participants.find((participant) => participant.id === turn.participantId);
    const target = combat.participants.find((participant) => participant.id === raw.targetId);

    await this.store.logAction(this.combatId(), {
      roundId: turn.roundId,
      turnId: turn.id,
      actorId: turn.participantId,
      actionType: raw.actionType,
      targetIds: this.showTargetField() && raw.targetId ? [raw.targetId] : [],
      actionCost: ACTION_CATALOG.find((item) => item.key === raw.actionType)?.defaultActionCost ?? 1,
      focusCost: raw.focusCost,
      hitResult: raw.hitResult,
      damageAmount: this.showDamageField() ? raw.damageAmount : 0,
      note: raw.note,
      linkedRoll:
        this.showRollField() && raw.rawD20 > 0
          ? {
              actorId: actor?.participantId,
              actorName: actor?.name,
              targetId: this.showTargetField() ? target?.participantId : undefined,
              targetName: this.showTargetField() ? target?.name : undefined,
              roundNumber: round?.roundNumber,
              rollCategory: raw.actionType === 'strike' || raw.actionType === 'reactive-strike' ? 'attack' : 'generic',
              rawD20: raw.rawD20,
              modifier: raw.modifier,
              outcome: this.rollOutcomeFromHitResult(raw.hitResult),
              note: raw.note || undefined,
            }
          : undefined,
    });

    this.actionForm.patchValue({
      damageAmount: 0,
      focusCost: this.selectedActionMeta()?.defaultFocusCost ?? 0,
      note: '',
    });
    this.advanceToNextOpenTurn();
  }

  async markReaction(): Promise<void> {
    const turn = this.selectedTurn();
    if (!turn) {
      return;
    }
    await this.store.updateTurn(this.combatId(), turn.id, { reactionUsed: true });
  }

  async adjustHealth(participantId: string, delta: number, reason = 'Manual HP adjustment'): Promise<void> {
    await this.store.logHealth(this.combatId(), { participantId, delta, reason });
  }

  async adjustFocus(participantId: string, delta: number): Promise<void> {
    await this.store.logFocus(this.combatId(), { participantId, delta, reason: 'Manual focus adjustment' });
  }

  async removeCondition(participantId: string, conditionName: string): Promise<void> {
    await this.store.logCondition(this.combatId(), { participantId, conditionName, operation: 'remove' });
  }

  async addCondition(): Promise<void> {
    const participant = this.selectedParticipant();
    const conditionName = this.conditionForm.controls.conditionName.value.trim();
    if (!participant || !conditionName) {
      return;
    }
    await this.store.logCondition(this.combatId(), { participantId: participant.id, conditionName, operation: 'add' });
    this.conditionForm.patchValue({ conditionName: '' });
  }

  openEnemySheet(): void {
    const sheet = this.selectedEnemySheet();
    if (!sheet) {
      return;
    }
    window.open(sheet.imagePath, '_blank', 'noopener,noreferrer');
  }

  async revertAction(actionEventId: string): Promise<void> {
    await this.store.revertAction(this.combatId(), actionEventId);
  }

  selectPinnedAction(actionKey: string): void {
    this.actionForm.patchValue({ actionType: actionKey });
  }

  setActionRawD20(value: number): void {
    this.actionForm.patchValue({ rawD20: value });
  }

  setConditionName(condition: string): void {
    this.conditionForm.patchValue({ conditionName: condition });
  }

  toggleField(field: 'useTarget' | 'useRoll' | 'trackDamage'): void {
    const control = this.actionForm.controls[field];
    const nextValue = !control.value;
    control.patchValue(nextValue);
    if (field === 'useTarget' && !nextValue) {
      this.actionForm.patchValue({ targetId: '' });
    }
    if (field === 'trackDamage' && !nextValue) {
      this.actionForm.patchValue({ damageAmount: 0 });
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleShortcut(event: KeyboardEvent): void {
    if (this.shouldIgnoreShortcut(event)) {
      return;
    }
    if (event.key >= '1' && event.key <= '6') {
      const index = Number(event.key) - 1;
      const key = this.pinnedActionKeys[index];
      if (key) {
        event.preventDefault();
        this.selectPinnedAction(key);
      }
      return;
    }
    if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      void this.markReaction();
      return;
    }
    if (event.key.toLowerCase() === 'n') {
      event.preventDefault();
      this.openRoundPlanner();
      return;
    }
    if (event.key === 'Enter' && this.selectedTurn()) {
      event.preventDefault();
      void this.logAction();
    }
  }

  private turnsForGroup(ids: string[], roundId: string): CombatTurn[] {
    return (
      this.store
        .combat()
        ?.turns.filter((turn) => turn.roundId === roundId && ids.includes(turn.participantId))
        .sort((left, right) => left.participantId.localeCompare(right.participantId)) ?? []
    );
  }

  private shouldIgnoreShortcut(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return false;
    }
    const tagName = target.tagName.toLowerCase();
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
  }

  private applyActionDefaults(actionType: string): void {
    const item = this.actionCatalog.find((entry) => entry.key === actionType);
    this.actionForm.patchValue({
      useTarget: item?.requiresTarget ?? false,
      useRoll: Boolean(item?.requiresRoll || item?.tags.includes('test')),
      trackDamage: item?.supportsDamage ?? false,
      focusCost: item?.defaultFocusCost ?? 0,
      targetId: item?.requiresTarget ? this.actionForm.controls.targetId.value : '',
      damageAmount: item?.supportsDamage ? this.actionForm.controls.damageAmount.value : 0,
      hitResult: item?.tags.includes('support') ? 'support' : 'neutral',
    });
  }

  private rollOutcomeFromHitResult(hitResult: HitResult) {
    switch (hitResult) {
      case 'criticalHit':
        return 'criticalSuccess' as const;
      case 'criticalMiss':
        return 'criticalFailure' as const;
      case 'graze':
        return 'graze' as const;
      case 'hit':
        return 'success' as const;
      case 'miss':
        return 'failure' as const;
      default:
        return 'neutral' as const;
    }
  }

  private advanceToNextOpenTurn(): void {
    const combat = this.store.combat();
    const currentTurn = this.selectedTurn();
    if (!combat || !currentTurn) {
      return;
    }
    const currentRoundId = currentTurn.roundId;
    const round = combat.rounds.find((entry) => entry.id === currentRoundId);
    const roundOrder = round
      ? [...round.fastPCIds, ...round.fastNPCIds, ...round.slowPCIds, ...round.slowNPCIds]
      : [];
    const roundTurns = roundOrder
      .map((participantId) =>
        combat.turns.find((turn) => turn.roundId === currentRoundId && turn.participantId === participantId),
      )
      .filter((turn): turn is CombatTurn => Boolean(turn));
    const nextOpenTurn = roundTurns.find(
      (turn) => turn.id !== currentTurn.id && turn.actionsUsed < turn.actionsAvailable,
    );
    if (nextOpenTurn) {
      this.selectTurn(nextOpenTurn);
      return;
    }
    const refreshedCurrent = combat.turns.find((turn) => turn.id === currentTurn.id);
    if (refreshedCurrent) {
      this.selectTurn(refreshedCurrent);
    }
    this.roundStatus.set('Round complete');
  }
}
