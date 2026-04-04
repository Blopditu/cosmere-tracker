import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { GoalProgressState, NPC, PCGoal, GoalUpsertInput, ResolvedSceneNode } from '@shared/domain';

const EMPTY_TEXT = '';

@Component({
  selector: 'app-campaign-goal-drawer',
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="war-room-drawer-shell">
      <div class="war-room-drawer-head">
        <div>
          <p class="eyebrow">PC goals</p>
          <h3>Manage goal hooks</h3>
          <p>Keep active player motivations visible in prep and linked into scenes.</p>
        </div>

        <div class="button-row wrap-row">
          <button type="button" class="button-outline micro-action" (click)="startCreate()">New goal</button>
          <button type="button" class="button-outline micro-action" (click)="close.emit()">Close</button>
        </div>
      </div>

      <div class="war-room-entity-workspace">
        <aside class="war-room-entity-list">
          @for (goal of goals(); track goal.id) {
            <button
              type="button"
              class="war-room-entity-row"
              [class.war-room-entity-row-active]="selectedGoalId() === goal.id"
              (click)="selectGoal(goal.id)"
            >
              <strong>{{ goal.title }}</strong>
              <span>{{ goal.ownerLabel }} · {{ goal.progressState }}</span>
            </button>
          } @empty {
            <p class="empty-inline">No goals yet.</p>
          }
        </aside>

        <form class="war-room-form" [formGroup]="form" (ngSubmit)="submit()">
          <div class="war-room-form-grid two-up">
            <label class="compact-field">
              <span>Owner</span>
              <input formControlName="ownerLabel" type="text" />
            </label>

            <label class="compact-field">
              <span>Progress state</span>
              <select formControlName="progressState">
                @for (state of progressStates; track state) {
                  <option [value]="state">{{ state }}</option>
                }
              </select>
            </label>
          </div>

          <label class="compact-field">
            <span>Title</span>
            <input formControlName="title" type="text" />
          </label>

          <label class="compact-field">
            <span>Description</span>
            <textarea formControlName="description" rows="4"></textarea>
          </label>

          <label class="compact-field">
            <span>Progress notes</span>
            <textarea formControlName="progressNotesText" rows="3"></textarea>
          </label>

          <section class="war-room-linked-section">
            <div class="war-room-section-head">
              <h4>Trigger scenes</h4>
              <span class="tag-chip">{{ selectedTriggerSceneIds().length }}</span>
            </div>
            <div class="selection-grid">
              @for (scene of scenes(); track scene.id) {
                <label class="selection-chip">
                  <input
                    type="checkbox"
                    [checked]="selectedTriggerSceneIds().includes(scene.id)"
                    (change)="toggleScene(scene.id)"
                  />
                  <span>{{ scene.title }}</span>
                </label>
              }
            </div>
          </section>

          <section class="war-room-linked-section">
            <div class="war-room-section-head">
              <h4>Trigger NPCs</h4>
              <span class="tag-chip">{{ selectedTriggerNpcIds().length }}</span>
            </div>
            <div class="selection-grid">
              @for (npc of npcs(); track npc.id) {
                <label class="selection-chip">
                  <input
                    type="checkbox"
                    [checked]="selectedTriggerNpcIds().includes(npc.id)"
                    (change)="toggleNpc(npc.id)"
                  />
                  <span>{{ npc.canonicalName }}</span>
                </label>
              }
            </div>
          </section>

          <div class="button-row war-room-form-actions">
            @if (selectedGoalId()) {
              <button type="button" class="button-outline button-danger micro-action" (click)="requestDelete.emit(selectedGoalId()!)">
                Delete goal
              </button>
            }
            <button type="submit">{{ selectedGoalId() ? 'Save goal' : 'Create goal' }}</button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class CampaignGoalDrawerComponent {
  readonly goals = input<PCGoal[]>([]);
  readonly scenes = input<ResolvedSceneNode[]>([]);
  readonly npcs = input<NPC[]>([]);
  readonly close = output<void>();
  readonly saveGoal = output<GoalUpsertInput>();
  readonly requestDelete = output<string>();

  readonly progressStates: GoalProgressState[] = ['active', 'advancing', 'blocked', 'resolved'];
  readonly isCreating = signal(false);
  readonly selectedGoalId = signal<string | null>(null);
  readonly selectedGoal = computed(() => this.goals().find((goal) => goal.id === this.selectedGoalId()) ?? null);

  readonly form = new FormGroup({
    ownerLabel: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    title: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    description: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    progressState: new FormControl<GoalProgressState>('active', { nonNullable: true }),
    progressNotesText: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    triggerSceneIds: new FormControl<string[]>([], { nonNullable: true }),
    triggerNpcIds: new FormControl<string[]>([], { nonNullable: true }),
  });

  readonly selectedTriggerSceneIds = computed(() => this.form.controls.triggerSceneIds.value);
  readonly selectedTriggerNpcIds = computed(() => this.form.controls.triggerNpcIds.value);

  constructor() {
    effect(() => {
      const goals = this.goals();
      if (this.isCreating()) {
        this.resetForm(null);
        return;
      }
      const selected = this.selectedGoalId();
      if (!goals.length) {
        this.selectedGoalId.set(null);
        this.resetForm(null);
        return;
      }
      if (!selected || !goals.some((goal) => goal.id === selected)) {
        this.selectedGoalId.set(goals[0]!.id);
        return;
      }
      this.resetForm(this.selectedGoal());
    });
  }

  selectGoal(goalId: string): void {
    this.isCreating.set(false);
    this.selectedGoalId.set(goalId);
  }

  startCreate(): void {
    this.isCreating.set(true);
    this.selectedGoalId.set(null);
    this.resetForm(null);
  }

  toggleScene(sceneId: string): void {
    this.form.controls.triggerSceneIds.setValue(this.toggleId(this.form.controls.triggerSceneIds.value, sceneId));
  }

  toggleNpc(npcId: string): void {
    this.form.controls.triggerNpcIds.setValue(this.toggleId(this.form.controls.triggerNpcIds.value, npcId));
  }

  submit(): void {
    this.saveGoal.emit({
      goalId: this.selectedGoalId() ?? undefined,
      ownerLabel: this.form.controls.ownerLabel.value,
      title: this.form.controls.title.value,
      description: this.form.controls.description.value,
      progressState: this.form.controls.progressState.value,
      progressNotes: this.parseLines(this.form.controls.progressNotesText.value),
      triggerSceneIds: this.form.controls.triggerSceneIds.value,
      triggerNpcIds: this.form.controls.triggerNpcIds.value,
    });
  }

  private resetForm(goal: PCGoal | null): void {
    this.form.reset({
      ownerLabel: goal?.ownerLabel ?? EMPTY_TEXT,
      title: goal?.title ?? EMPTY_TEXT,
      description: goal?.description ?? EMPTY_TEXT,
      progressState: goal?.progressState ?? 'active',
      progressNotesText: goal?.progressNotes.join('\n') ?? EMPTY_TEXT,
      triggerSceneIds: [...(goal?.triggerSceneIds ?? [])],
      triggerNpcIds: [...(goal?.triggerNpcIds ?? [])],
    });
  }

  private parseLines(value: string): string[] {
    return value
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  private toggleId(current: string[], value: string): string[] {
    return current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
  }
}
