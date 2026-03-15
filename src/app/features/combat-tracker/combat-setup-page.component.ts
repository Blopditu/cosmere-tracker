import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CreateCombatInput, ParticipantSide, TurnType } from '@shared/domain';
import { SessionStoreService } from '../../core/session-store.service';
import { RosharIconComponent } from '../../shared/roshar-icon.component';
import { CombatStore } from './combat.store';
import { nextAvailableOrdinal, toAlphabeticSuffix } from './combat-setup.utils';

@Component({
  selector: 'app-combat-setup-page',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RosharIconComponent],
  template: `
    <section class="page-header combat-setup-header card engraved-panel">
      <div class="route-heading">
        <p class="eyebrow">Combat setup</p>
        <h2>Encounter builder</h2>
        <p>Pull in the party, add enemy copies from reserve, set Fast or Slow inline, and create round one in a single pass.</p>
      </div>
      <div class="encounter-header-summary">
        <article class="route-stat sapphire">
            <app-roshar-icon key="sessions" label="Roster size" tone="sapphire" [size]="18" />
            <span class="eyebrow">Roster</span>
            <strong>{{ participants().length }}</strong>
          </article>
          <article class="route-stat topaz">
            <app-roshar-icon key="fast" label="Fast turns" tone="topaz" [size]="18" />
            <span class="eyebrow">Fast</span>
            <strong>{{ fastCount() }}</strong>
          </article>
          <article class="route-stat ruby">
            <app-roshar-icon key="slow" label="Slow turns" tone="ruby" [size]="18" />
            <span class="eyebrow">Slow</span>
            <strong>{{ slowCount() }}</strong>
          </article>
      </div>
    </section>

    <section class="card engraved-panel encounter-builder-card">
      <div class="encounter-toolbar">
        <div class="encounter-meta">
          <div class="section-heading">
            <app-roshar-icon key="combat" label="New combat" tone="ruby" [size]="18" />
            <h3>New combat</h3>
          </div>
          <span class="pill">{{ participants().length }} participants</span>
        </div>
        <div class="tempo-summary-row" data-tour="combat-setup-round">
          <span class="tag-chip">
            <app-roshar-icon key="fast" label="Fast turns" tone="topaz" [size]="14" />
            {{ fastCount() }} fast
          </span>
          <span class="tag-chip">
            <app-roshar-icon key="slow" label="Slow turns" tone="sapphire" [size]="14" />
            {{ slowCount() }} slow
          </span>
        </div>
      </div>

      <form class="form-grid" [formGroup]="form" (ngSubmit)="submit()">
        <div class="encounter-topline full-width">
          <label>
            <span>Combat title</span>
            <input formControlName="title" type="text" />
          </label>
          <label>
            <span>Notes</span>
            <textarea formControlName="notes" rows="2"></textarea>
          </label>
        </div>

        <div class="full-width split-grid">
          <div class="card inset-panel roster-panel" data-tour="combat-setup-participants">
            <div class="card-header compact-card-header">
              <div class="section-heading">
                <app-roshar-icon key="sessions" label="Participants" tone="sapphire" [size]="18" />
                <h3>Participants</h3>
              </div>
              <span class="pill">{{ participants().length }} in roster</span>
            </div>
            <div class="enemy-reserve">
              <p class="eyebrow">Enemy reserve</p>
              <div class="button-row">
                @for (template of enemyTemplates(); track template.participantId) {
                  <button type="button" class="button-outline shell-shortcut micro-button" (click)="addEnemy(template.participantId)">
                    <app-roshar-icon key="combat" [label]="template.name" tone="ruby" [size]="14" />
                    <span>Add {{ template.name }}</span>
                  </button>
                } @empty {
                  <span class="tag-chip">No enemy reserve yet. Add enemy templates on the session dashboard first.</span>
                }
              </div>
            </div>
            <div class="roster-grid-head">
              <span>Name</span>
              <span>Role</span>
              <span>HP</span>
              <span>Focus</span>
              <span>Tempo</span>
              <span></span>
            </div>
            @for (group of participantGroups(); track group.label) {
              <section class="roster-section">
                <div class="section-heading roster-section-heading">
                  <app-roshar-icon [key]="group.tone === 'ruby' ? 'combat' : 'sessions'" [label]="group.label" [tone]="group.tone" [size]="16" />
                  <h3>{{ group.label }}</h3>
                  <span class="tag-chip">{{ group.entries.length }}</span>
                </div>
                <div class="roster-editor-list">
                  @for (participant of group.entries; track participant.participantId) {
                    <article class="roster-editor-row encounter-row">
                      <input [(ngModel)]="participant.name" [ngModelOptions]="{ standalone: true }" type="text" placeholder="Name" (ngModelChange)="touchParticipants()" />
                      <input [(ngModel)]="participant.role" [ngModelOptions]="{ standalone: true }" type="text" placeholder="Role" (ngModelChange)="touchParticipants()" />
                      <input [(ngModel)]="participant.currentHealth" [ngModelOptions]="{ standalone: true }" type="number" min="0" placeholder="Start HP" (ngModelChange)="touchParticipants()" />
                      <input [(ngModel)]="participant.currentFocus" [ngModelOptions]="{ standalone: true }" type="number" min="0" placeholder="Start Focus" (ngModelChange)="touchParticipants()" />
                      <div class="tempo-toggle" role="group" aria-label="Turn tempo">
                        <button type="button" class="button-outline micro-button" [class.active]="participant.tempo === 'fast'" (click)="setTempo(participant.participantId, 'fast')">Fast</button>
                        <button type="button" class="button-outline micro-button" [class.active]="participant.tempo === 'slow'" (click)="setTempo(participant.participantId, 'slow')">Slow</button>
                      </div>
                      <button type="button" class="button-outline button-danger micro-button" (click)="removeParticipant(participant.participantId)">Remove</button>
                    </article>
                  }
                </div>
              </section>
            }
          </div>
        </div>

        <div class="button-row full-width">
          <button type="submit" (click)="submitMode.set('queue')">Prepare combat</button>
          <button type="submit" class="button-outline" (click)="submitMode.set('open')">Prepare and open</button>
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
  readonly dashboardLoaded = signal(false);
  readonly submitMode = signal<'queue' | 'open'>('queue');
  readonly participants = signal<
    Array<{
      participantId: string;
      name: string;
      side: ParticipantSide;
      role?: string;
      imagePath?: string;
      currentHealth?: number;
      currentFocus?: number;
      maxHealth?: number;
      maxFocus?: number;
      sourceTemplateId?: string;
      templateOrdinal?: number;
      tempo: TurnType;
    }>
  >([]);
  readonly enemyTemplates = signal<
    Array<{
      participantId: string;
      name: string;
      side: ParticipantSide;
      role?: string;
      imagePath?: string;
      maxHealth?: number;
      maxFocus?: number;
    }>
  >([]);
  readonly fastCount = computed(() => this.participants().filter((entry) => entry.tempo === 'fast').length);
  readonly slowCount = computed(() => this.participants().filter((entry) => entry.tempo === 'slow').length);
  readonly participantGroups = computed(() => [
    {
      label: 'Party and allies',
      tone: 'sapphire' as const,
      entries: this.participants().filter((entry) => entry.side === 'pc' || entry.side === 'ally'),
    },
    {
      label: 'Enemies and NPCs',
      tone: 'ruby' as const,
      entries: this.participants().filter((entry) => entry.side === 'enemy' || entry.side === 'npc'),
    },
  ].filter((group) => group.entries.length));

  readonly form = this.fb.nonNullable.group({
    title: ['Tower corridor skirmish', Validators.required],
    notes: [''],
  });

  constructor() {
    const sub = this.route.paramMap.subscribe((params) => {
      const sessionId = params.get('sessionId');
      if (!sessionId) {
        return;
      }
      this.sessionId.set(sessionId);
      void this.sessionStore.getDashboard(sessionId).then((dashboard) => {
        const seededParticipants = dashboard.session.partyMembers.map((member) => ({
          participantId: member.id,
          name: member.name,
          side: member.side,
          role: member.role,
          imagePath: member.imagePath,
          currentHealth: member.maxHealth,
          currentFocus: member.maxFocus ?? 0,
          maxHealth: member.maxHealth,
          maxFocus: member.maxFocus,
          tempo: this.defaultTempoForSide(member.side),
        }));
        this.enemyTemplates.set(
          dashboard.participantTemplates.map((template) => ({
          participantId: template.id,
          name: template.name,
          side: template.side,
          role: template.role,
          imagePath: template.imagePath,
          maxHealth: template.maxHealth,
          maxFocus: template.maxFocus,
          })),
        );
        this.participants.set(seededParticipants);
        this.dashboardLoaded.set(true);
      });
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  async submit(): Promise<void> {
    const initialRound = this.buildInitialRound();
    const payload: CreateCombatInput = {
      title: this.form.controls.title.value,
      notes: this.form.controls.notes.value,
      participants: this.participants().map((participant) => ({
        participantId: participant.participantId,
        name: participant.name.trim(),
        side: participant.side,
        imagePath: participant.imagePath,
        currentHealth: participant.currentHealth ?? undefined,
        currentFocus: participant.currentFocus ?? 0,
        maxHealth: participant.maxHealth ?? undefined,
        maxFocus: participant.maxFocus ?? undefined,
      })),
      initialRound,
    };
    const combat = await this.combatStore.create(this.sessionId(), payload);
    if (this.submitMode() === 'open') {
      await this.router.navigate(['/sessions', this.sessionId(), 'combats', combat.id]);
      return;
    }
    await this.router.navigate(['/sessions', this.sessionId(), 'combats']);
  }

  addEnemy(templateId: string): void {
    const template = this.enemyTemplates().find((entry) => entry.participantId === templateId);
    if (!template) {
      return;
    }
    const ordinal = nextAvailableOrdinal(
      this.participants()
        .filter((entry) => entry.sourceTemplateId === templateId && entry.templateOrdinal !== undefined)
        .map((entry) => entry.templateOrdinal as number),
    );
    const participantId = `${templateId}:${crypto.randomUUID()}`;
    const name = `${template.name} ${toAlphabeticSuffix(ordinal)}`;
    this.participants.update((items) => [
      ...items,
      {
        participantId,
        sourceTemplateId: templateId,
        templateOrdinal: ordinal,
        name,
        side: template.side,
        role: template.role,
        imagePath: template.imagePath,
        currentHealth: template.maxHealth,
        currentFocus: template.maxFocus ?? 0,
        maxHealth: template.maxHealth,
        maxFocus: template.maxFocus,
        tempo: 'slow',
      },
    ]);
  }

  removeParticipant(participantId: string): void {
    this.participants.update((items) => items.filter((entry) => entry.participantId !== participantId));
  }

  touchParticipants(): void {
    this.participants.update((items) => [...items]);
  }

  setTempo(participantId: string, tempo: TurnType): void {
    this.participants.update((items) =>
      items.map((entry) => (entry.participantId === participantId ? { ...entry, tempo } : entry)),
    );
  }

  private defaultTempoForSide(side: ParticipantSide): TurnType {
    return side === 'pc' || side === 'ally' ? 'fast' : 'slow';
  }

  private buildInitialRound(): CreateCombatInput['initialRound'] {
    const fastPCIds: string[] = [];
    const fastNPCIds: string[] = [];
    const slowPCIds: string[] = [];
    const slowNPCIds: string[] = [];

    for (const participant of this.participants()) {
      if (participant.tempo === 'fast') {
        if (participant.side === 'pc' || participant.side === 'ally') {
          fastPCIds.push(participant.participantId);
        } else {
          fastNPCIds.push(participant.participantId);
        }
      } else if (participant.side === 'pc' || participant.side === 'ally') {
        slowPCIds.push(participant.participantId);
      } else {
        slowNPCIds.push(participant.participantId);
      }
    }

    return { fastPCIds, fastNPCIds, slowPCIds, slowNPCIds };
  }
}
