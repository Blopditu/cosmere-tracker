import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  CharacterStatSheet,
  ParticipantTemplate,
  PartyMember,
  SessionAnalytics,
  SessionDashboard,
  computeCharacterStatSheet,
  createEmptyCharacterStatSheet,
} from '@shared/domain';
import { createId } from '../../core/default-data';
import { SessionStoreService } from '../../core/session-store.service';
import { CombatPresetActionEditorComponent } from '../../shared/combat-preset-action-editor.component';
import { CharacterStatSheetEditorComponent } from '../../shared/character-stat-sheet-editor.component';
import { EnemySupplementEditorComponent } from '../../shared/enemy-supplement-editor.component';
import { RosharIconComponent } from '../../shared/roshar-icon.component';
import { CombatStore } from '../combat-tracker/combat.store';

const PARTY_VIEW = 'party';
const ENEMY_VIEW = 'enemy';
type RosterView = typeof PARTY_VIEW | typeof ENEMY_VIEW;

@Component({
  selector: 'app-session-dashboard-page',
  imports: [
    CommonModule,
    RouterLink,
    RosharIconComponent,
    CombatPresetActionEditorComponent,
    CharacterStatSheetEditorComponent,
    EnemySupplementEditorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (dashboard()) {
      <section class="page-header session-dashboard-header card engraved-panel">
        <div class="route-heading">
          <p class="eyebrow">Session dashboard</p>
          <h2>{{ dashboard()!.session.title }}</h2>
          <p>{{ dashboard()!.session.notes || 'Session hub for roster, rolls, combat, and stage cues.' }}</p>
        </div>
        <div class="dashboard-command-links" data-tour="dashboard-actions">
          <div class="button-row">
            <a [routerLink]="['/sessions', dashboard()!.session.id, 'rolls']">Rolls</a>
            <a [routerLink]="['/sessions', dashboard()!.session.id, 'combats']" class="button-outline">Combat queue</a>
            <a [routerLink]="['/sessions', dashboard()!.session.id, 'combats', 'new']" class="button-outline">Prepare combat</a>
            <a [routerLink]="['/gm/stage-manager', dashboard()!.session.id]" class="button-outline">Stage</a>
          </div>
          <div class="session-command-chips">
            <span class="tag-chip">
              <app-roshar-icon key="sessions" label="Party count" tone="sapphire" [size]="14" />
              {{ dashboard()!.session.partyMembers.length }} in session
            </span>
            <span class="tag-chip">
              <app-roshar-icon key="combat" label="Combat count" tone="ruby" [size]="14" />
              {{ dashboard()!.session.combatCount }} combats
            </span>
            <span class="tag-chip">
              <app-roshar-icon key="stage" label="Stage scenes" tone="emerald" [size]="14" />
              {{ dashboard()!.session.stageSceneCount }} scenes
            </span>
            <span class="tag-chip">
              <app-roshar-icon key="combat" label="Enemy templates" tone="ruby" [size]="14" />
              {{ dashboard()!.participantTemplates.length }} enemy templates
            </span>
          </div>
        </div>
      </section>

      <section class="session-pulse-grid">
        <article class="card stat-card gemstone-stat sapphire">
          <app-roshar-icon key="sessions" label="Party members" tone="sapphire" [size]="20" />
          <span class="stat-label">Session players</span>
          <strong>{{ dashboard()!.session.partyMembers.length }}</strong>
        </article>
        <article class="card stat-card gemstone-stat topaz">
          <app-roshar-icon key="rolls" label="Rolls logged" tone="topaz" [size]="20" />
          <span class="stat-label">Rolls logged</span>
          <strong>{{ dashboard()!.session.rollCount }}</strong>
        </article>
        <article class="card stat-card gemstone-stat ruby">
          <app-roshar-icon key="combat" label="Combats" tone="ruby" [size]="20" />
          <span class="stat-label">Combats</span>
          <strong>{{ dashboard()!.session.combatCount }}</strong>
        </article>
        <article class="card stat-card gemstone-stat emerald">
          <app-roshar-icon key="stage" label="Stage scenes" tone="emerald" [size]="20" />
          <span class="stat-label">Stage scenes</span>
          <strong>{{ dashboard()!.session.stageSceneCount }}</strong>
        </article>
      </section>

      @if (analytics()) {
        <section class="card engraved-panel dashboard-recap session-pulse-panel">
          <div class="card-header">
            <div class="section-heading">
              <app-roshar-icon key="chronicle" label="Session pulse" tone="topaz" [size]="18" />
              <h3>Session pulse</h3>
            </div>
            <span class="pill">{{ analytics()!.totalCombats }} combats tracked</span>
          </div>
          <div class="stats-grid summary-highlights">
            <article class="stat-card gemstone-stat ruby">
              <span class="stat-label">Damage dealt</span>
              <strong>{{ analytics()!.totalDamageDealt }}</strong>
              <small>{{ analytics()!.awards.mostDamageDealt || 'None' }} led</small>
            </article>
            <article class="stat-card gemstone-stat sapphire">
              <span class="stat-label">Average d20</span>
              <strong>{{ analytics()!.averageRawD20 | number: '1.1-1' }}</strong>
              <small>{{ analytics()!.awards.mostAccurate || 'None' }} most accurate</small>
            </article>
            <article class="stat-card gemstone-stat topaz">
              <span class="stat-label">Focus spent</span>
              <strong>{{ analytics()!.totalFocusSpent }}</strong>
              <small>{{ analytics()!.awards.focusPressureLeader || 'None' }} spent the most</small>
            </article>
            <article class="stat-card gemstone-stat emerald">
              <span class="stat-label">Biggest hit</span>
              <strong>{{ analytics()!.awards.biggestHit || 'None' }}</strong>
              <small>{{ analytics()!.nat20Count }} nat 20s / {{ analytics()!.nat1Count }} nat 1s</small>
            </article>
          </div>
          <div class="table-wrap">
            <table class="summary-table">
              <thead>
                <tr>
                  <th>Actor</th>
                  <th>Damage dealt</th>
                  <th>Damage taken</th>
                  <th>Hit rate</th>
                  <th>Focus</th>
                  <th>Support</th>
                </tr>
              </thead>
              <tbody>
                @for (row of analytics()!.partyPerformance.slice(0, 6); track row.actorName) {
                  <tr>
                    <td>{{ row.actorName }}</td>
                    <td>{{ row.totalDamageDealt }}</td>
                    <td>{{ row.totalDamageTaken }}</td>
                    <td>{{ row.hitRate | percent: '1.0-0' }}</td>
                    <td>{{ row.focusSpent }}</td>
                    <td>{{ row.supportActionsUsed }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }

      <div class="layout-columns dashboard-overview-columns">
        <section class="card engraved-panel roster-management" data-tour="dashboard-roster">
          <div class="card-header roster-management-toolbar">
            <div class="section-heading">
              <app-roshar-icon key="sessions" label="Roster management" tone="gold" [size]="18" />
              <h3>Roster</h3>
            </div>
            <div class="button-row">
              <a class="button-outline shell-shortcut" routerLink="/campaign/roster">
                <app-roshar-icon key="dashboard" label="Open campaign roster" tone="topaz" [size]="16" />
                <span>Campaign roster</span>
              </a>
              <button type="button" class="shell-shortcut" (click)="saveRoster()">
                <app-roshar-icon key="aid" label="Save session cast" tone="gold" [size]="16" />
                <span>Save session cast</span>
              </button>
            </div>
          </div>

          @if (rosterView() === 'party') {
            <section class="roster-workspace">
              <aside class="inset-panel roster-selector-panel">
                <div class="card-header roster-panel-toolbar">
                  <div class="roster-view-toggle roster-view-toggle--inline">
                    <button type="button" class="button-outline micro-button" [class.active]="rosterView() === 'party'" (click)="rosterView.set('party')">Party</button>
                    <button type="button" class="button-outline micro-button" [class.active]="rosterView() === 'enemy'" (click)="rosterView.set('enemy')">Enemies</button>
                  </div>
                  <button type="button" class="button-outline shell-shortcut" (click)="addPartyMember()">
                    <app-roshar-icon key="aid" label="Add player" tone="sapphire" [size]="16" />
                    <span>Add player</span>
                  </button>
                </div>
                <div class="roster-selector-list">
                  @for (member of partyDraft(); track member.id) {
                    <article class="roster-selector-item" [class.selected]="selectedPartyMemberId() === member.id">
                      <button type="button" class="roster-selector-button" (click)="selectPartyMember(member.id)">
                        <div class="roster-selector-copy">
                          <strong>{{ member.name || 'New player' }}</strong>
                          <small>{{ playerSubtitle(member) }}</small>
                        </div>
                        <div class="roster-selector-resources">
                          <span class="tag-chip">HP {{ resourceSummary(member).health }}</span>
                          <span class="tag-chip">Focus {{ resourceSummary(member).focus }}</span>
                          <span class="tag-chip">Investiture {{ resourceSummary(member).investiture }}</span>
                        </div>
                      </button>
                      <div class="roster-selector-actions">
                        <button type="button" class="button-outline micro-button" [class.active]="sessionPlayerIdsDraft().includes(member.id)" (click)="toggleSessionPlayer(member.id)">
                          {{ sessionPlayerIdsDraft().includes(member.id) ? 'In session' : 'Bench' }}
                        </button>
                        <button type="button" class="button-outline button-danger micro-button" (click)="confirmRosterRemoval('party', member.id, member.name)">Remove</button>
                      </div>
                    </article>
                  } @empty {
                    <article class="empty-card">No players yet. Add a campaign character, then shape the full sheet on the right.</article>
                  }
                </div>
              </aside>

              <section class="inset-panel roster-detail-panel">
                @if (selectedPartyMember(); as member) {
                  <header class="roster-detail-header">
                    <div class="roster-detail-fields">
                      <label class="compact-field">
                        <span>Name</span>
                        <input type="text" [value]="member.name" placeholder="Name" (input)="updatePartyText(member.id, 'name', textValue($event))" />
                      </label>
                      <label class="compact-field">
                        <span>Role</span>
                        <input type="text" [value]="member.role || ''" placeholder="Role" (input)="updatePartyText(member.id, 'role', textValue($event))" />
                      </label>
                      <label class="compact-field">
                        <span>Level</span>
                        <input type="number" min="1" [value]="member.level ?? ''" placeholder="1" (input)="updatePartyLevel(member.id, numericValue($event))" />
                      </label>
                    </div>
                    <div class="roster-detail-side">
                      <div class="button-row">
                        <button type="button" class="button-outline micro-button" [class.active]="sessionPlayerIdsDraft().includes(member.id)" (click)="toggleSessionPlayer(member.id)">
                          {{ sessionPlayerIdsDraft().includes(member.id) ? 'In session' : 'Bench' }}
                        </button>
                        <button type="button" class="button-outline button-danger micro-button" (click)="confirmRosterRemoval('party', member.id, member.name)">
                          Remove player
                        </button>
                      </div>
                    </div>
                  </header>

                  <app-character-stat-sheet-editor [stats]="member.stats" mode="party" (statsChange)="updatePartyStats(member.id, $event)" />
                } @else {
                  <article class="empty-card roster-detail-empty">No player selected. Choose a campaign character or add a new one to start editing.</article>
                }
              </section>
            </section>
          } @else {
            <section class="roster-workspace">
              <aside class="inset-panel roster-selector-panel">
                <div class="card-header roster-panel-toolbar">
                  <div class="roster-view-toggle roster-view-toggle--inline">
                    <button type="button" class="button-outline micro-button" [class.active]="rosterView() === 'party'" (click)="rosterView.set('party')">Party</button>
                    <button type="button" class="button-outline micro-button" [class.active]="rosterView() === 'enemy'" (click)="rosterView.set('enemy')">Enemies</button>
                  </div>
                  <button type="button" class="button-outline shell-shortcut" (click)="addEnemyTemplate()">
                    <app-roshar-icon key="aid" label="Add enemy template" tone="ruby" [size]="16" />
                    <span>Add enemy</span>
                  </button>
                </div>
                <div class="roster-selector-list">
                  @for (enemy of enemyDraft(); track enemy.id) {
                    <article class="roster-selector-item" [class.selected]="selectedEnemyId() === enemy.id">
                      <button type="button" class="roster-selector-button" (click)="selectEnemy(enemy.id)">
                        <div class="roster-selector-copy">
                          <strong>{{ enemy.name || 'New enemy template' }}</strong>
                          <small>{{ enemy.role || 'No role set' }}</small>
                        </div>
                        <div class="roster-selector-resources">
                          <span class="tag-chip">HP {{ resourceSummary(enemy).health }}</span>
                          <span class="tag-chip">Focus {{ resourceSummary(enemy).focus }}</span>
                          <span class="tag-chip">Investiture {{ resourceSummary(enemy).investiture }}</span>
                        </div>
                      </button>
                      <div class="roster-selector-actions">
                        <button type="button" class="button-outline button-danger micro-button" (click)="confirmRosterRemoval('enemy', enemy.id, enemy.name)">Remove</button>
                      </div>
                    </article>
                  } @empty {
                    <article class="empty-card">No enemy templates yet. Add a reusable foe and shape its combat-facing sheet on the right.</article>
                  }
                </div>
              </aside>

              <section class="inset-panel roster-detail-panel">
                @if (selectedEnemy(); as enemy) {
                  <header class="roster-detail-header roster-detail-header--enemy">
                    <div class="roster-detail-fields">
                      <label class="compact-field">
                        <span>Name</span>
                        <input type="text" [value]="enemy.name" placeholder="Enemy name" (input)="updateEnemyText(enemy.id, 'name', textValue($event))" />
                      </label>
                      <label class="compact-field">
                        <span>Role</span>
                        <input type="text" [value]="enemy.role || ''" placeholder="Role" (input)="updateEnemyText(enemy.id, 'role', textValue($event))" />
                      </label>
                    </div>
                    <div class="roster-detail-side">
                      <div class="enemy-sheet-cell">
                        @if (enemy.imagePath) {
                          <button type="button" class="enemy-sheet-thumb" [style.background-image]="'url(' + enemy.imagePath + ')'" (click)="openSheet(enemy.imagePath)"></button>
                        } @else {
                          <span class="tag-chip">No sheet</span>
                        }
                        <label class="button-outline micro-button file-trigger">
                          <span>{{ uploadingEnemyId() === enemy.id ? 'Uploading...' : 'Upload sheet' }}</span>
                          <input type="file" accept="image/*" (change)="uploadEnemySheet(enemy.id, $event)" />
                        </label>
                        @if (enemy.imagePath) {
                          <button type="button" class="button-outline micro-button" (click)="openSheet(enemy.imagePath)">Open</button>
                        }
                        <button type="button" class="button-outline button-danger micro-button" (click)="confirmRosterRemoval('enemy', enemy.id, enemy.name)">
                          Remove enemy
                        </button>
                      </div>
                    </div>
                  </header>

                  <div class="roster-detail-stack">
                    <app-character-stat-sheet-editor [stats]="enemy.stats" mode="enemy" (statsChange)="updateEnemyStats(enemy.id, $event)" />
                    <app-combat-preset-action-editor
                      [actions]="enemy.presetActions"
                      title="Enemy preset actions"
                      emptyLabel="No preset actions yet. Add reusable enemy actions here."
                      [compact]="true"
                      (actionsChange)="updateEnemyPresetActions(enemy.id, $event)" />
                    <app-enemy-supplement-editor
                      [features]="enemy.features"
                      [tactics]="enemy.tactics || ''"
                      [sourceAdversaryName]="enemy.sourceAdversaryName || ''"
                      (addFeature)="addEnemyFeature(enemy.id)"
                      (removeFeature)="removeEnemyFeature(enemy.id, $event)"
                      (featureChange)="updateEnemyFeature(enemy.id, $event.index, $event.value)"
                      (tacticsChange)="updateEnemyTactics(enemy.id, $event)" />
                  </div>
                } @else {
                  <article class="empty-card roster-detail-empty">No enemy selected. Choose or add an enemy template to edit its stat block.</article>
                }
                @if (uploadError()) {
                  <p class="import-message">{{ uploadError() }}</p>
                }
              </section>
            </section>
          }
        </section>

        <section class="dashboard-stream">
          <section class="card engraved-panel" data-tour="dashboard-party">
            <div class="card-header">
              <h3>Party overview</h3>
              <span class="pill">Session cast</span>
            </div>
            <div class="list-stack">
              @for (member of dashboard()!.session.partyMembers; track member.id) {
                <article class="list-card ledger-row">
                  <div>
                    <h3>{{ member.name }}</h3>
                    <p>{{ playerSubtitle(member) }}</p>
                  </div>
                  <div class="ledger-meta">
                    <span class="tag-chip">
                      <app-roshar-icon key="focus" label="Focus" tone="topaz" [size]="14" />
                      {{ member.maxFocus ?? 0 }} focus
                    </span>
                  </div>
                </article>
              } @empty {
                <article class="empty-card">No players are assigned to this session yet. Mark campaign characters as “In session” in the roster editor, then save the roster.</article>
              }
            </div>
          </section>

          <div class="layout-columns dashboard-stream-columns">
            <section class="card engraved-panel">
              <div class="card-header">
                <h3>Recent rolls</h3>
                <span class="pill">{{ dashboard()!.recentRolls.length }}</span>
              </div>
              <div class="list-stack">
                @for (roll of dashboard()!.recentRolls; track roll.id) {
                  <article class="timeline-item">
                    <strong class="event-line">
                      <app-roshar-icon key="rolls" label="Recent roll" tone="topaz" [size]="16" />
                      {{ roll.actorName || roll.actorId || 'Unknown' }}
                    </strong>
                    <p>{{ roll.rollCategory }} • d20 {{ roll.rawD20 }} + {{ roll.modifier }} = {{ roll.total }}</p>
                  </article>
                } @empty {
                  <article class="empty-card">No rolls logged yet. Open the roll ledger to start the session chronicle.</article>
                }
              </div>
            </section>

            <section class="card engraved-panel" data-tour="dashboard-combats">
              <div class="card-header">
                <h3>Recent combats</h3>
                <span class="pill">{{ dashboard()!.recentCombats.length }}</span>
              </div>
              <div class="list-stack">
                @for (combat of dashboard()!.recentCombats; track combat.id) {
                  <article class="list-card ledger-row">
                    <div>
                      <h3>{{ combat.title }}</h3>
                      <p>{{ combat.status }} • round {{ combat.currentRoundNumber || 0 }}</p>
                    </div>
                    <div class="button-row">
                      <a class="button-outline shell-shortcut" [routerLink]="['/sessions', dashboard()!.session.id, 'combats', combat.id]">
                        <app-roshar-icon key="combat" label="Open combat" tone="ruby" [size]="16" />
                        <span>Open</span>
                      </a>
                      @if (combat.status === 'planned') {
                        <button type="button" class="shell-shortcut" (click)="startPreparedCombat(combat.id)">
                          <app-roshar-icon key="live" label="Start combat" tone="topaz" [size]="16" />
                          <span>Start</span>
                        </button>
                      }
                    </div>
                  </article>
                } @empty {
                  <article class="empty-card">No combats recorded yet. Prepare several encounters in the combat queue, then start the right one when the table reaches it.</article>
                }
              </div>
            </section>
          </div>
        </section>
      </div>
    } @else {
      <section class="card empty-card">Loading session dashboard...</section>
    }

    @if (pendingRemoval()) {
      <div class="confirm-modal-backdrop" (click)="cancelRosterRemoval()"></div>
      <section class="confirm-modal card engraved-panel" role="dialog" aria-modal="true" aria-labelledby="roster-delete-title">
        <div class="card-header">
          <div class="section-heading">
            <app-roshar-icon key="damage" label="Delete roster entry" tone="ruby" [size]="18" />
            <h3 id="roster-delete-title">Delete roster entry?</h3>
          </div>
        </div>
        <p>
          Remove
          <strong>{{ pendingRemoval()!.label || (pendingRemoval()!.type === 'party' ? 'this player' : 'this enemy template') }}</strong>
          from the campaign roster?
        </p>
        <p class="muted">This removal now saves immediately and removes the entry from the campaign-wide roster while also clearing it from this session if it was assigned here.</p>
        <div class="button-row">
          <button type="button" class="button-outline" (click)="cancelRosterRemoval()">Cancel</button>
          <button type="button" class="button-danger" (click)="confirmPendingRemoval()">Delete</button>
        </div>
      </section>
    }
  `,
})
export class SessionDashboardPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly sessionStore = inject(SessionStoreService);
  private readonly combatStore = inject(CombatStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly sessionId = signal('');
  readonly dashboard = signal<SessionDashboard | null>(null);
  readonly analytics = signal<SessionAnalytics | null>(null);
  readonly partyDraft = signal<PartyMember[]>([]);
  readonly enemyDraft = signal<ParticipantTemplate[]>([]);
  readonly sessionPlayerIdsDraft = signal<string[]>([]);
  readonly rosterView = signal<RosterView>('party');
  readonly uploadingEnemyId = signal('');
  readonly uploadError = signal('');
  readonly pendingRemoval = signal<{ type: RosterView; id: string; label: string } | null>(null);
  readonly selectedPartyMemberId = signal('');
  readonly selectedEnemyId = signal('');
  readonly selectedPartyMember = computed(() => this.partyDraft().find((member) => member.id === this.selectedPartyMemberId()));
  readonly selectedEnemy = computed(() => this.enemyDraft().find((enemy) => enemy.id === this.selectedEnemyId()));

  constructor() {
    const sub = this.route.paramMap.subscribe((params) => {
      const sessionId = params.get('sessionId');
      if (sessionId) {
        this.sessionId.set(sessionId);
        void this.load(sessionId);
      }
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  private async load(sessionId: string): Promise<void> {
    const [dashboard, analytics] = await Promise.all([
      this.sessionStore.getDashboard(sessionId),
      this.sessionStore.getAnalytics(sessionId),
    ]);
    this.dashboard.set(dashboard);
    this.analytics.set(analytics);
    this.partyDraft.set(dashboard.campaignPartyMembers.map((member) => ({ ...member })));
    this.enemyDraft.set(dashboard.participantTemplates.map((enemy) => this.cloneEnemyTemplate(enemy)));
    this.sessionPlayerIdsDraft.set([...dashboard.session.playerIds]);
    this.syncPartySelection();
    this.syncEnemySelection();
  }

  addPartyMember(): void {
    const id = createId('party-member');
    this.partyDraft.update((items) => [
      ...items,
      {
        id,
        name: '',
        side: 'pc',
      role: '',
      level: 1,
      stats: createEmptyCharacterStatSheet(),
        maxHealth: undefined,
        maxFocus: undefined,
        maxInvestiture: undefined,
      },
    ]);
    this.sessionPlayerIdsDraft.update((items) => [...items, id]);
    this.selectedPartyMemberId.set(id);
  }

  addEnemyTemplate(): void {
    const enemyId = createId('enemy-template');
    this.enemyDraft.update((items) => [
      ...items,
      {
        id: enemyId,
        name: '',
        side: 'enemy',
        role: '',
        stats: createEmptyCharacterStatSheet(),
        maxHealth: undefined,
        maxFocus: undefined,
        maxInvestiture: undefined,
        features: [],
        tactics: '',
        sourceAdversaryName: undefined,
        presetActions: [],
      },
    ]);
    this.selectedEnemyId.set(enemyId);
  }

  selectPartyMember(memberId: string): void {
    this.selectedPartyMemberId.set(memberId);
  }

  selectEnemy(enemyId: string): void {
    this.selectedEnemyId.set(enemyId);
  }

  updatePartyText(memberId: string, field: 'name' | 'role', value: string): void {
    this.partyDraft.update((items) => items.map((member) => (member.id === memberId ? { ...member, [field]: value } : member)));
  }

  updatePartyLevel(memberId: string, value: number | undefined): void {
    this.partyDraft.update((items) =>
      items.map((member) => (member.id === memberId ? { ...member, level: value } : member)),
    );
  }

  updateEnemyText(enemyId: string, field: 'name' | 'role', value: string): void {
    this.enemyDraft.update((items) => items.map((enemy) => (enemy.id === enemyId ? { ...enemy, [field]: value } : enemy)));
  }

  updateEnemyPresetActions(enemyId: string, presetActions: ParticipantTemplate['presetActions']): void {
    this.enemyDraft.update((items) =>
      items.map((enemy) =>
        enemy.id === enemyId ? { ...enemy, presetActions: presetActions.map((action) => ({ ...action })) } : enemy,
      ),
    );
  }

  addEnemyFeature(enemyId: string): void {
    this.enemyDraft.update((items) =>
      items.map((enemy) => (enemy.id === enemyId ? { ...enemy, features: [...enemy.features, ''] } : enemy)),
    );
  }

  removeEnemyFeature(enemyId: string, index: number): void {
    this.enemyDraft.update((items) =>
      items.map((enemy) =>
        enemy.id === enemyId ? { ...enemy, features: enemy.features.filter((_, featureIndex) => featureIndex !== index) } : enemy,
      ),
    );
  }

  updateEnemyFeature(enemyId: string, index: number, value: string): void {
    this.enemyDraft.update((items) =>
      items.map((enemy) =>
        enemy.id === enemyId
          ? {
              ...enemy,
              features: enemy.features.map((feature, featureIndex) => (featureIndex === index ? value : feature)),
            }
          : enemy,
      ),
    );
  }

  updateEnemyTactics(enemyId: string, tactics: string): void {
    this.enemyDraft.update((items) =>
      items.map((enemy) => (enemy.id === enemyId ? { ...enemy, tactics } : enemy)),
    );
  }

  updatePartyStats(memberId: string, stats: CharacterStatSheet): void {
    this.partyDraft.update((items) => items.map((member) => (member.id === memberId ? { ...member, stats } : member)));
  }

  updateEnemyStats(enemyId: string, stats: CharacterStatSheet): void {
    this.enemyDraft.update((items) => items.map((enemy) => (enemy.id === enemyId ? { ...enemy, stats } : enemy)));
  }

  confirmRosterRemoval(type: RosterView, id: string, label: string | undefined): void {
    this.pendingRemoval.set({ type, id, label: label?.trim() || '' });
  }

  cancelRosterRemoval(): void {
    this.pendingRemoval.set(null);
  }

  async confirmPendingRemoval(): Promise<void> {
    const pending = this.pendingRemoval();
    if (!pending) {
      return;
    }
    if (pending.type === PARTY_VIEW) {
      this.partyDraft.update((items) => items.filter((member) => member.id !== pending.id));
      this.sessionPlayerIdsDraft.update((items) => items.filter((entry) => entry !== pending.id));
      this.syncPartySelection();
    } else {
      this.enemyDraft.update((items) => items.filter((enemy) => enemy.id !== pending.id));
      this.syncEnemySelection();
    }
    this.pendingRemoval.set(null);
    await this.saveRoster();
  }

  async uploadEnemySheet(enemyId: string, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.uploadingEnemyId.set(enemyId);
    this.uploadError.set('');
    try {
      const imagePath = await this.sessionStore.uploadEnemySheet(this.sessionId(), file);
      this.enemyDraft.update((items) =>
        items.map((enemy) => (enemy.id === enemyId ? { ...enemy, imagePath } : enemy)),
      );
    } catch (error) {
      this.uploadError.set(error instanceof Error ? error.message : 'Enemy sheet upload failed.');
    } finally {
      this.uploadingEnemyId.set('');
      input.value = '';
    }
  }

  openSheet(imagePath: string | undefined): void {
    if (!imagePath) {
      return;
    }
    window.open(imagePath, '_blank', 'noopener,noreferrer');
  }

  async saveRoster(): Promise<void> {
    const normalizedParty = this.partyDraft()
      .map((member) => this.normalizeRosterEntry(member, 'pc'))
      .filter((member): member is PartyMember => Boolean(member));
    const normalizedEnemies = this.enemyDraft()
      .map((enemy) => this.normalizeRosterEntry(enemy, 'enemy'))
      .filter((enemy): enemy is ParticipantTemplate => Boolean(enemy));

    await this.sessionStore.updateSession(this.sessionId(), {
      playerIds: this.sessionPlayerIdsDraft().filter((playerId) => normalizedParty.some((member) => member.id === playerId)),
      partyMembers: normalizedParty,
      participantTemplates: normalizedEnemies,
    });
    await this.load(this.sessionId());
  }

  toggleSessionPlayer(playerId: string): void {
    this.sessionPlayerIdsDraft.update((items) =>
      items.includes(playerId) ? items.filter((entry) => entry !== playerId) : [...items, playerId],
    );
  }

  async startPreparedCombat(combatId: string): Promise<void> {
    await this.combatStore.startCombat(combatId);
    await this.router.navigate(['/sessions', this.sessionId(), 'combats', combatId]);
  }

  private normalizeRosterEntry<T extends PartyMember | ParticipantTemplate>(
    entry: T,
    side: 'pc' | 'enemy',
  ): T | null {
    const name = entry.name.trim();
    if (!name) {
      return null;
    }
    const role = entry.role?.trim();
    return {
      ...entry,
      name,
      side,
      role: role || undefined,
      stats: entry.stats,
      maxHealth: entry.maxHealth ?? undefined,
      maxFocus: entry.maxFocus ?? undefined,
      maxInvestiture: entry.maxInvestiture ?? undefined,
      imagePath: entry.imagePath || undefined,
      features: 'features' in entry ? entry.features.map((feature) => feature.trim()).filter(Boolean) : [],
      tactics: 'tactics' in entry ? entry.tactics?.trim() || undefined : undefined,
      sourceAdversaryName: 'sourceAdversaryName' in entry ? entry.sourceAdversaryName?.trim() || undefined : undefined,
      presetActions: 'presetActions' in entry ? entry.presetActions.map((action) => ({ ...action })) : [],
    };
  }

  resourceSummary(entry: PartyMember | ParticipantTemplate): { health: number; focus: number; investiture: number } {
    const computed = computeCharacterStatSheet(entry.stats);
    return computed.resources;
  }

  textValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  numericValue(event: Event): number | undefined {
    const rawValue = (event.target as HTMLInputElement).value;
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined;
  }

  playerSubtitle(member: PartyMember): string {
    if (member.role && member.level) {
      return `Level ${member.level} ${member.role}`;
    }
    if (member.level) {
      return `Level ${member.level}`;
    }
    return member.role || 'No role set';
  }

  private syncPartySelection(): void {
    if (this.partyDraft().some((member) => member.id === this.selectedPartyMemberId())) {
      return;
    }
    this.selectedPartyMemberId.set(this.partyDraft()[0]?.id ?? '');
  }

  private syncEnemySelection(): void {
    if (this.enemyDraft().some((enemy) => enemy.id === this.selectedEnemyId())) {
      return;
    }
    this.selectedEnemyId.set(this.enemyDraft()[0]?.id ?? '');
  }

  private cloneEnemyTemplate(template: ParticipantTemplate): ParticipantTemplate {
    return {
      ...template,
      stats: {
        ...template.stats,
        attributeScores: { ...template.stats.attributeScores },
        skillRanks: { ...template.stats.skillRanks },
        expertises: template.stats.expertises.map((expertise) => ({ ...expertise })),
        resourceBonuses: { ...template.stats.resourceBonuses },
        resourceOverrides: { ...template.stats.resourceOverrides },
        defenseBonuses: { ...template.stats.defenseBonuses },
        derivedOverrides: { ...template.stats.derivedOverrides },
      },
      features: [...template.features],
      presetActions: template.presetActions.map((action) => ({ ...action })),
    };
  }
}
