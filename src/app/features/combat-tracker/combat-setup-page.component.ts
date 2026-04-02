import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CombatPresetAction, CreateCombatInput, ParticipantSide, computeCharacterStatSheet } from '@shared/domain';
import { SessionStoreService } from '../../core/session-store.service';
import { CombatPresetActionEditorComponent } from '../../shared/combat-preset-action-editor.component';
import { RosharIconComponent } from '../../shared/roshar-icon.component';
import { CombatStore } from './combat.store';
import { nextAvailableOrdinal, toAlphabeticSuffix } from './combat-setup.utils';

interface EditableCombatParticipant {
  participantId: string;
  name: string;
  side: ParticipantSide;
  role?: string;
  imagePath?: string;
  currentHealth?: number;
  currentFocus?: number;
  maxHealth?: number;
  maxFocus?: number;
  currentInvestiture?: number;
  maxInvestiture?: number;
  presetActions: CombatPresetAction[];
  sourceTemplateId?: string;
  templateOrdinal?: number;
}

function computeCharacterResources(entry: {
  stats: Parameters<typeof computeCharacterStatSheet>[0];
  maxHealth?: number;
  maxFocus?: number;
  maxInvestiture?: number;
}): Pick<
  EditableCombatParticipant,
  'currentHealth' | 'currentFocus' | 'currentInvestiture' | 'maxHealth' | 'maxFocus' | 'maxInvestiture'
> {
  const computed = computeCharacterStatSheet(entry.stats);
  return {
    maxHealth: entry.maxHealth ?? computed.resources.health,
    currentHealth: entry.maxHealth ?? computed.resources.health,
    maxFocus: entry.maxFocus ?? computed.resources.focus,
    currentFocus: entry.maxFocus ?? computed.resources.focus,
    maxInvestiture: entry.maxInvestiture ?? computed.resources.investiture,
    currentInvestiture: entry.maxInvestiture ?? computed.resources.investiture,
  };
}

@Component({
  selector: 'app-combat-setup-page',
  imports: [CommonModule, ReactiveFormsModule, RosharIconComponent, CombatPresetActionEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-header combat-setup-header card engraved-panel">
      <div class="route-heading">
        <p class="eyebrow">Combat setup</p>
        <h2>Encounter builder</h2>
        <p>Pull in the party, add enemy copies from reserve, and queue the encounter. Fast and Slow choices happen live once combat begins.</p>
      </div>
      <div class="encounter-header-summary">
        <article class="route-stat sapphire">
          <app-roshar-icon key="sessions" label="Roster size" tone="sapphire" [size]="18" />
          <span class="eyebrow">Roster</span>
          <strong>{{ participants().length }}</strong>
        </article>
        <article class="route-stat topaz">
          <app-roshar-icon key="sessions" label="Player side" tone="topaz" [size]="18" />
          <span class="eyebrow">Player side</span>
          <strong>{{ playerSideCount() }}</strong>
        </article>
        <article class="route-stat ruby">
          <app-roshar-icon key="combat" label="Opposition" tone="ruby" [size]="18" />
          <span class="eyebrow">Opposition</span>
          <strong>{{ oppositionCount() }}</strong>
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
        <span class="tag-chip">Round flow is planned on the live tracker.</span>
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
            <div class="roster-grid-head encounter-grid-head">
              <span>Name</span>
              <span>Role</span>
              <span>HP</span>
              <span>Focus</span>
              <span>Investiture</span>
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
                      <input
                        [value]="participant.name"
                        type="text"
                        placeholder="Name"
                        (input)="updateTextField(participant.participantId, 'name', $any($event.target).value)"
                      />
                      <input
                        [value]="participant.role ?? ''"
                        type="text"
                        placeholder="Role"
                        (input)="updateTextField(participant.participantId, 'role', $any($event.target).value)"
                      />
                      <input
                        [value]="participant.currentHealth ?? ''"
                        type="number"
                        min="0"
                        placeholder="Start HP"
                        (input)="updateNumberField(participant.participantId, 'currentHealth', $any($event.target).value)"
                      />
                      <input
                        [value]="participant.currentFocus ?? ''"
                        type="number"
                        min="0"
                        placeholder="Start Focus"
                        (input)="updateNumberField(participant.participantId, 'currentFocus', $any($event.target).value)"
                      />
                      <input
                        [value]="participant.currentInvestiture ?? ''"
                        type="number"
                        min="0"
                        placeholder="Start Investiture"
                        (input)="updateNumberField(participant.participantId, 'currentInvestiture', $any($event.target).value)"
                      />
                      <button type="button" class="button-outline button-danger micro-button" (click)="removeParticipant(participant.participantId)">Remove</button>
                      @if (participant.side === 'enemy' || participant.side === 'npc') {
                        <app-combat-preset-action-editor
                          class="roster-preset-editor"
                          [actions]="participant.presetActions"
                          [compact]="true"
                          title="Encounter preset actions"
                          emptyLabel="No copied preset actions on this enemy yet."
                          (actionsChange)="updateParticipantPresetActions(participant.participantId, $event)" />
                      }
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
  readonly participants = signal<EditableCombatParticipant[]>([]);
  readonly enemyTemplates = signal<
    Array<{
      participantId: string;
      name: string;
      side: ParticipantSide;
      role?: string;
      imagePath?: string;
      maxHealth?: number;
      maxFocus?: number;
      maxInvestiture?: number;
      presetActions: CombatPresetAction[];
    }>
  >([]);

  readonly playerSideCount = computed(() => this.participants().filter((entry) => entry.side === 'pc' || entry.side === 'ally').length);
  readonly oppositionCount = computed(() => this.participants().filter((entry) => entry.side === 'enemy' || entry.side === 'npc').length);
  readonly participantGroups = computed(() =>
    [
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
    ].filter((group) => group.entries.length),
  );

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
        const seededParticipants: EditableCombatParticipant[] = dashboard.session.partyMembers.map((member) => ({
          ...computeCharacterResources(member),
          participantId: member.id,
          name: member.name,
          side: member.side,
          role: member.role,
          imagePath: member.imagePath,
          presetActions: [],
        }));
        this.enemyTemplates.set(
          dashboard.participantTemplates.map((template) => ({
            ...computeCharacterResources(template),
            participantId: template.id,
            name: template.name,
            side: template.side,
            role: template.role,
            imagePath: template.imagePath,
            presetActions: [...template.presetActions],
          })),
        );
        this.participants.set(seededParticipants);
        this.dashboardLoaded.set(true);
      });
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  async submit(): Promise<void> {
    const payload: CreateCombatInput = {
      title: this.form.controls.title.value,
      notes: this.form.controls.notes.value,
      participants: this.participants().map((participant) => ({
        participantId: participant.participantId,
        name: participant.name.trim(),
        side: participant.side,
        imagePath: participant.imagePath,
        presetActions: participant.presetActions,
        currentHealth: participant.currentHealth ?? undefined,
        currentFocus: participant.currentFocus ?? 0,
        currentInvestiture: participant.currentInvestiture ?? 0,
        maxHealth: participant.maxHealth ?? undefined,
        maxFocus: participant.maxFocus ?? undefined,
        maxInvestiture: participant.maxInvestiture ?? undefined,
      })),
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
        presetActions: [...template.presetActions],
        currentHealth: template.maxHealth,
        currentFocus: template.maxFocus ?? 0,
        currentInvestiture: template.maxInvestiture ?? 0,
        maxHealth: template.maxHealth,
        maxFocus: template.maxFocus,
        maxInvestiture: template.maxInvestiture,
      },
    ]);
  }

  removeParticipant(participantId: string): void {
    this.participants.update((items) => items.filter((entry) => entry.participantId !== participantId));
  }

  updateParticipantPresetActions(participantId: string, presetActions: CombatPresetAction[]): void {
    this.participants.update((items) =>
      items.map((entry) => (entry.participantId === participantId ? { ...entry, presetActions: [...presetActions] } : entry)),
    );
  }

  updateTextField(participantId: string, field: 'name' | 'role', value: string): void {
    this.participants.update((items) =>
      items.map((entry) =>
        entry.participantId === participantId
          ? {
              ...entry,
              [field]: value,
            }
          : entry,
      ),
    );
  }

  updateNumberField(
    participantId: string,
    field: 'currentHealth' | 'currentFocus' | 'currentInvestiture',
    value: string,
  ): void {
    const normalized = value === '' ? undefined : Number(value);
    this.participants.update((items) =>
      items.map((entry) =>
        entry.participantId === participantId
          ? {
              ...entry,
              [field]: Number.isFinite(normalized) ? normalized : undefined,
            }
          : entry,
      ),
    );
  }
}
