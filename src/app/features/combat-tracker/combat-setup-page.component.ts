import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CreateCombatInput, ParticipantSide } from '@shared/domain';
import { SessionStoreService } from '../../core/session-store.service';
import { CombatStore } from './combat.store';

@Component({
  selector: 'app-combat-setup-page',
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Combat setup</p>
        <h2>Build a round-ready encounter</h2>
        <p>Pull in the party, add enemy templates, assign fast and slow turns, and create round one in one pass.</p>
      </div>
    </section>

    <section class="card">
      <div class="card-header">
        <h3>New combat</h3>
        <span class="pill">{{ participants().length }} participants</span>
      </div>

      <form class="form-grid" [formGroup]="form" (ngSubmit)="submit()">
        <label class="full-width">
          <span>Combat title</span>
          <input formControlName="title" type="text" />
        </label>
        <label class="full-width">
          <span>Notes</span>
          <textarea formControlName="notes" rows="2"></textarea>
        </label>

        <div class="full-width split-grid">
          <div class="card inset-panel" data-tour="combat-setup-participants">
            <h3>Participants</h3>
            <div class="list-stack">
              @for (participant of participants(); track participant.participantId) {
                <article class="list-card">
                  <div>
                    <h3>{{ participant.name }}</h3>
                    <p>{{ participant.side }} • HP {{ participant.currentHealth || '-' }} • Focus {{ participant.currentFocus }}</p>
                  </div>
                  <span class="tag-chip">{{ participant.role || 'field' }}</span>
                </article>
              }
            </div>
          </div>

          <div class="card inset-panel" data-tour="combat-setup-round">
            <h3>Round one assignments</h3>
            <div class="assignment-grid">
              <label>
                <span>Fast PCs</span>
                <select multiple formControlName="fastPCIds" size="5">
                  @for (participant of pcParticipants(); track participant.participantId) {
                    <option [value]="participant.participantId">{{ participant.name }}</option>
                  }
                </select>
              </label>
              <label>
                <span>Fast NPCs</span>
                <select multiple formControlName="fastNPCIds" size="5">
                  @for (participant of npcParticipants(); track participant.participantId) {
                    <option [value]="participant.participantId">{{ participant.name }}</option>
                  }
                </select>
              </label>
              <label>
                <span>Slow PCs</span>
                <select multiple formControlName="slowPCIds" size="5">
                  @for (participant of pcParticipants(); track participant.participantId) {
                    <option [value]="participant.participantId">{{ participant.name }}</option>
                  }
                </select>
              </label>
              <label>
                <span>Slow NPCs</span>
                <select multiple formControlName="slowNPCIds" size="5">
                  @for (participant of npcParticipants(); track participant.participantId) {
                    <option [value]="participant.participantId">{{ participant.name }}</option>
                  }
                </select>
              </label>
            </div>
          </div>
        </div>

        <div class="button-row full-width">
          <button type="submit">Create combat</button>
        </div>
      </form>
    </section>
  `,
})
export class CombatSetupPageComponent {
  readonly combatStore = inject(CombatStore);
  readonly sessionStore = inject(SessionStoreService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  readonly sessionId = signal('');
  readonly participants = signal<
    Array<{
      participantId: string;
      name: string;
      side: ParticipantSide;
      role?: string;
      currentHealth?: number;
      currentFocus?: number;
      maxHealth?: number;
      maxFocus?: number;
    }>
  >([]);
  readonly pcParticipants = computed(() => this.participants().filter((entry) => entry.side === 'pc' || entry.side === 'ally'));
  readonly npcParticipants = computed(() => this.participants().filter((entry) => entry.side === 'enemy' || entry.side === 'npc'));

  readonly form = this.fb.nonNullable.group({
    title: ['Tower corridor skirmish', Validators.required],
    notes: [''],
    fastPCIds: [[] as string[]],
    fastNPCIds: [[] as string[]],
    slowPCIds: [[] as string[]],
    slowNPCIds: [[] as string[]],
  });

  constructor() {
    const sub = this.route.paramMap.subscribe((params) => {
      const sessionId = params.get('sessionId');
      if (!sessionId) {
        return;
      }
      this.sessionId.set(sessionId);
      const session = this.sessionStore.sessions().find((entry) => entry.id === sessionId);
      if (!session) {
        return;
      }
      const seededParticipants = [
        ...session.partyMembers.map((member) => ({
          participantId: member.id,
          name: member.name,
          side: member.side,
          role: member.role,
          currentHealth: member.maxHealth,
          currentFocus: member.maxFocus ?? 0,
          maxHealth: member.maxHealth,
          maxFocus: member.maxFocus,
        })),
        ...session.participantTemplates.map((template) => ({
          participantId: template.id,
          name: template.name,
          side: template.side,
          role: template.role,
          currentHealth: template.maxHealth,
          currentFocus: template.maxFocus ?? 0,
          maxHealth: template.maxHealth,
          maxFocus: template.maxFocus,
        })),
      ];
      this.participants.set(seededParticipants);
      this.form.patchValue({
        fastPCIds: seededParticipants.filter((participant) => participant.side === 'pc').map((participant) => participant.participantId),
        slowNPCIds: seededParticipants
          .filter((participant) => participant.side === 'enemy' || participant.side === 'npc')
          .map((participant) => participant.participantId),
      });
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  async submit(): Promise<void> {
    const raw = this.form.getRawValue();
    const payload: CreateCombatInput = {
      title: raw.title,
      notes: raw.notes,
      participants: this.participants(),
      initialRound: {
        fastPCIds: this.mapIds(raw.fastPCIds),
        fastNPCIds: this.mapIds(raw.fastNPCIds),
        slowPCIds: this.mapIds(raw.slowPCIds),
        slowNPCIds: this.mapIds(raw.slowNPCIds),
      },
    };
    const combat = await this.combatStore.create(this.sessionId(), payload);
    await this.router.navigate(['/sessions', this.sessionId(), 'combats', combat.id]);
  }

  private mapIds(values: string[] | string): string[] {
    return Array.isArray(values) ? values : values ? [values] : [];
  }
}
