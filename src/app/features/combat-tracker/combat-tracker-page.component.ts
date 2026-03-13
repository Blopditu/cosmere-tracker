import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ACTION_CATALOG, CombatTurn } from '@shared/domain';
import { CombatStore } from './combat.store';

@Component({
  selector: 'app-combat-tracker-page',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    @if (store.combat()) {
      <section class="page-header">
        <div>
          <p class="eyebrow">Combat tracker</p>
          <h2>{{ store.combat()!.title }}</h2>
          <p>{{ store.combat()!.status }} combat with {{ store.combat()!.participants.length }} participants.</p>
        </div>
        <div class="button-row">
          <button type="button" (click)="startCombat()">Start combat</button>
          <button type="button" class="button-outline" (click)="createNextRound()">Next round</button>
          <button type="button" class="button-outline" (click)="finishCombat()">Finish combat</button>
          <a [routerLink]="['/sessions', store.combat()!.sessionId, 'combats', store.combat()!.id, 'summary']" class="button-outline">Summary</a>
        </div>
      </section>

      <div class="combat-layout">
        <aside class="card" data-tour="combat-participants">
          <div class="card-header">
            <h3>Participants</h3>
            <span class="pill">Round {{ store.combat()!.currentRoundNumber || 1 }}</span>
          </div>
          <div class="list-stack">
            @for (participant of store.combat()!.participants; track participant.id) {
              <button class="list-item-button" type="button" [class.active]="selectedParticipantId() === participant.id" (click)="selectedParticipantId.set(participant.id)">
                <span>{{ participant.name }}</span>
                <span>{{ participant.currentHealth ?? '-' }} HP / {{ participant.currentFocus }} focus</span>
              </button>
            }
          </div>
        </aside>

        <section class="card" data-tour="combat-turn-groups">
          <div class="card-header">
            <h3>Turn groups</h3>
            <span class="pill">{{ store.combat()!.turns.length }} turns</span>
          </div>
          <div class="turn-group-grid">
            @for (group of groupedRounds(); track group.label) {
              <section class="inset-panel">
                <h3>{{ group.label }}</h3>
                <div class="list-stack">
                  @for (turn of group.turns; track turn.id) {
                    <button class="list-item-button" type="button" [class.active]="selectedTurnId() === turn.id" (click)="selectTurn(turn)">
                      <span>{{ participantName(turn.participantId) }}</span>
                      <span>{{ turn.actionsUsed }}/{{ turn.actionsAvailable }} actions</span>
                    </button>
                  }
                </div>
              </section>
            }
          </div>
        </section>

        <section class="card" data-tour="combat-action-logger">
          <div class="card-header">
            <h3>Quick action logger</h3>
            <span class="pill">{{ selectedTurn()?.turnType || 'Select turn' }}</span>
          </div>

          @if (selectedTurn()) {
            <form class="form-grid" [formGroup]="actionForm" (ngSubmit)="logAction()">
              <label>
                <span>Action</span>
                <select formControlName="actionType">
                  @for (item of actionCatalog; track item.key) {
                    <option [value]="item.key">{{ item.name }}</option>
                  }
                </select>
              </label>
              <label>
                <span>Target</span>
                <select formControlName="targetId">
                  <option value="">No target</option>
                  @for (participant of availableTargets(); track participant.id) {
                    <option [value]="participant.id">{{ participant.name }}</option>
                  }
                </select>
              </label>
              <label>
                <span>d20</span>
                <input formControlName="rawD20" type="number" min="1" max="20" />
              </label>
              <label>
                <span>Modifier</span>
                <input formControlName="modifier" type="number" />
              </label>
              <label>
                <span>Hit result</span>
                <select formControlName="hitResult">
                  <option value="neutral">Neutral</option>
                  <option value="hit">Hit</option>
                  <option value="miss">Miss</option>
                  <option value="crit">Crit</option>
                  <option value="support">Support</option>
                </select>
              </label>
              <label>
                <span>Damage</span>
                <input formControlName="damageAmount" type="number" min="0" />
              </label>
              <label>
                <span>Focus cost</span>
                <input formControlName="focusCost" type="number" min="0" />
              </label>
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
      </div>

      <section class="card" data-tour="combat-feed">
        <div class="card-header">
          <h3>Combat event feed</h3>
          <span class="pill">{{ store.combat()!.actionEvents.length }}</span>
        </div>
        <div class="list-stack">
          @for (event of store.combat()!.actionEvents.slice().reverse(); track event.id) {
            <article class="timeline-item">
              <strong>{{ participantName(event.actorId) }} used {{ actionName(event.actionType) }}</strong>
              <p>{{ event.hitResult || 'neutral' }} • damage {{ event.damageAmount || 0 }} • focus {{ event.focusCost }}</p>
              <small>{{ event.note || 'No note' }}</small>
            </article>
          } @empty {
            <article class="empty-card">No actions logged yet.</article>
          }
        </div>
      </section>
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
  readonly selectedTurnId = signal('');
  readonly selectedParticipantId = signal('');
  readonly selectedTurn = computed(
    () => this.store.combat()?.turns.find((turn) => turn.id === this.selectedTurnId()) ?? null,
  );
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

  readonly actionForm = this.fb.nonNullable.group({
    actionType: ['strike'],
    targetId: [''],
    rawD20: [10],
    modifier: [0],
    hitResult: ['neutral'],
    damageAmount: [0],
    focusCost: [0],
    note: [''],
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
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  participantName(participantId: string): string {
    return this.store.combat()?.participants.find((participant) => participant.id === participantId)?.name ?? 'Unknown';
  }

  actionName(actionType: string): string {
    return this.actionCatalog.find((entry) => entry.key === actionType)?.name ?? actionType;
  }

  selectTurn(turn: CombatTurn): void {
    this.selectedTurnId.set(turn.id);
    this.selectedParticipantId.set(turn.participantId);
  }

  async startCombat(): Promise<void> {
    await this.store.startCombat(this.combatId());
  }

  async finishCombat(): Promise<void> {
    await this.store.finishCombat(this.combatId());
  }

  async createNextRound(): Promise<void> {
    const combat = this.store.combat();
    const previous = combat?.rounds.at(-1);
    if (!combat || !previous) {
      return;
    }
    await this.store.createRound(this.combatId(), {
      fastPCIds: previous.fastPCIds,
      fastNPCIds: previous.fastNPCIds,
      slowPCIds: previous.slowPCIds,
      slowNPCIds: previous.slowNPCIds,
    });
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
      targetIds: raw.targetId ? [raw.targetId] : [],
      actionCost: ACTION_CATALOG.find((item) => item.key === raw.actionType)?.defaultActionCost ?? 1,
      focusCost: raw.focusCost,
      hitResult: raw.hitResult as 'hit' | 'miss' | 'crit' | 'support' | 'neutral',
      damageAmount: raw.damageAmount,
      note: raw.note,
      linkedRoll:
        raw.rawD20 > 0
          ? {
              actorId: actor?.participantId,
              actorName: actor?.name,
              targetId: target?.participantId,
              targetName: target?.name,
              roundNumber: round?.roundNumber,
              rollCategory: raw.actionType === 'strike' || raw.actionType === 'reactive-strike' ? 'attack' : 'generic',
              rawD20: raw.rawD20,
              modifier: raw.modifier,
              outcome:
                raw.hitResult === 'crit'
                  ? 'criticalSuccess'
                  : raw.hitResult === 'miss'
                    ? 'failure'
                    : raw.hitResult === 'hit'
                      ? 'success'
                      : 'neutral',
              note: raw.note || undefined,
            }
          : undefined,
    });
    this.actionForm.patchValue({ damageAmount: 0, focusCost: 0, note: '' });
  }

  async markReaction(): Promise<void> {
    const turn = this.selectedTurn();
    if (!turn) {
      return;
    }
    await this.store.updateTurn(this.combatId(), turn.id, { reactionUsed: true });
  }

  private turnsForGroup(ids: string[], roundId: string): CombatTurn[] {
    return (
      this.store
        .combat()
        ?.turns.filter((turn) => turn.roundId === roundId && ids.includes(turn.participantId))
        .sort((left, right) => left.participantId.localeCompare(right.participantId)) ?? []
    );
  }
}
