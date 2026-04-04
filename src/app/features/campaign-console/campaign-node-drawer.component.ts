import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, input, output } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  FlowNodeClassification,
  FlowNodeReadiness,
  Location,
  NPC,
  NPCAppearance,
  PCGoal,
  ResolvedSceneNode,
  SceneEdge,
  SceneEdgeCreateInput,
  SceneEdgeDeleteInput,
  SceneNodeUpsertInput,
  SceneNpcAppearanceInput,
} from '@shared/domain';
import {
  FLOW_NODE_CLASSIFICATION_LABELS,
  FLOW_NODE_READINESS_LABELS,
  SCENE_KIND_LABELS,
} from './campaign-console-planning.helpers';

const DEFAULT_SCENE_KIND: ResolvedSceneNode['sceneKind'] = 'social';
const DEFAULT_CLASSIFICATION: FlowNodeClassification = 'optional';
const DEFAULT_READINESS: FlowNodeReadiness = 'draft';
const DEFAULT_PRIORITY = 100;
const EMPTY_TEXT = '';

type SceneKind = ResolvedSceneNode['sceneKind'];

interface AppearanceFormValue {
  appearanceId: string;
  npcId: string;
  aliasInScene: string;
  stance: NonNullable<SceneNpcAppearanceInput['stance']> | '';
  localGoal: string;
  localSecretsText: string;
  portrayalOverrideText: string;
  notesText: string;
}

@Component({
  selector: 'app-campaign-node-drawer',
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="war-room-drawer-shell">
      <div class="war-room-drawer-head">
        <div>
          <p class="eyebrow">Flow node</p>
          <h3>{{ drawerTitle() }}</h3>
          <p>{{ drawerSubtitle() }}</p>
        </div>

        <div class="button-row wrap-row">
          @if (scene()) {
            <button type="button" class="button-outline button-danger micro-action" (click)="requestDeleteNode.emit(scene()!.id)">
              Delete node
            </button>
          }
          <button type="button" class="button-outline micro-action" (click)="close.emit()">Close</button>
        </div>
      </div>

      <form class="war-room-form" [formGroup]="form" (ngSubmit)="submit()">
        <div class="war-room-form-grid two-up">
          <label class="compact-field">
            <span>Title</span>
            <input formControlName="title" type="text" />
          </label>

          <label class="compact-field">
            <span>Key</span>
            <input formControlName="key" type="text" />
          </label>

          <label class="compact-field">
            <span>Scene kind</span>
            <select formControlName="sceneKind">
              @for (entry of sceneKindOptions; track entry.value) {
                <option [value]="entry.value">{{ entry.label }}</option>
              }
            </select>
          </label>

          <label class="compact-field">
            <span>Classification</span>
            <select formControlName="classification">
              @for (entry of classificationOptions; track entry.value) {
                <option [value]="entry.value">{{ entry.label }}</option>
              }
            </select>
          </label>

          <label class="compact-field">
            <span>Readiness</span>
            <select formControlName="readiness">
              @for (entry of readinessOptions; track entry.value) {
                <option [value]="entry.value">{{ entry.label }}</option>
              }
            </select>
          </label>

          <label class="compact-field">
            <span>Lane</span>
            <input formControlName="lane" type="text" placeholder="core" />
          </label>

          <label class="compact-field">
            <span>Grid X</span>
            <input formControlName="boardX" type="number" />
          </label>

          <label class="compact-field">
            <span>Grid Y</span>
            <input formControlName="boardY" type="number" />
          </label>
        </div>

        <div class="war-room-toggle-strip">
          <label class="checkbox-row">
            <input formControlName="isDefaultStartScene" type="checkbox" />
            <span>Chapter start scene</span>
          </label>

          <label class="checkbox-row">
            <input formControlName="isRequiredBeat" type="checkbox" />
            <span>Required beat</span>
          </label>
        </div>

        <label class="compact-field">
          <span>Focus</span>
          <input formControlName="focus" type="text" placeholder="What this scene is really about at the table" />
        </label>

        <div class="war-room-form-grid two-up">
          <label class="compact-field">
            <span>Summary</span>
            <textarea formControlName="summary" rows="4"></textarea>
          </label>

          <label class="compact-field">
            <span>GM note</span>
            <textarea formControlName="gmNote" rows="4"></textarea>
          </label>

          <label class="compact-field">
            <span>Hidden truth</span>
            <textarea formControlName="hiddenTruth" rows="4"></textarea>
          </label>

          <label class="compact-field">
            <span>Note / runtime frame</span>
            <textarea formControlName="note" rows="4"></textarea>
          </label>
        </div>

        <label class="compact-field">
          <span>Tags</span>
          <textarea formControlName="tagsText" rows="2" placeholder="search, warcamp, clue"></textarea>
        </label>

        <section class="war-room-linked-section">
          <div class="war-room-section-head">
            <h4>Locations</h4>
            <span class="tag-chip">{{ selectedLocationIds().length }} linked</span>
          </div>
          <div class="selection-grid">
            @for (location of locations(); track location.id) {
              <label class="selection-chip">
                <input
                  type="checkbox"
                  [checked]="selectedLocationIds().includes(location.id)"
                  (change)="toggleLocation(location.id)"
                />
                <span>{{ location.name }}</span>
              </label>
            } @empty {
              <p class="empty-inline">No locations yet.</p>
            }
          </div>
        </section>

        <section class="war-room-linked-section">
          <div class="war-room-section-head">
            <h4>PC goals</h4>
            <span class="tag-chip">{{ selectedGoalIds().length }} linked</span>
          </div>
          <div class="selection-grid">
            @for (goal of goals(); track goal.id) {
              <label class="selection-chip">
                <input
                  type="checkbox"
                  [checked]="selectedGoalIds().includes(goal.id)"
                  (change)="toggleGoal(goal.id)"
                />
                <span>{{ goal.title }}</span>
              </label>
            } @empty {
              <p class="empty-inline">No goals yet.</p>
            }
          </div>
        </section>

        <section class="war-room-linked-section">
          <div class="war-room-section-head">
            <h4>NPC appearances</h4>
            <div class="button-row">
              <button type="button" class="button-outline micro-action" (click)="addAppearance()">Add NPC</button>
            </div>
          </div>

          <div class="entity-stack" formArrayName="npcAppearances">
            @for (group of npcAppearanceForms.controls; track $index) {
              <article class="mini-panel war-room-inline-panel" [formGroupName]="$index">
                <div class="war-room-inline-panel-head">
                  <strong>Appearance {{ $index + 1 }}</strong>
                  <button type="button" class="button-outline micro-action button-danger" (click)="removeAppearance($index)">
                    Remove
                  </button>
                </div>

                <div class="war-room-form-grid two-up">
                  <label class="compact-field">
                    <span>NPC</span>
                    <select formControlName="npcId">
                      <option value="">Choose NPC</option>
                      @for (npc of npcs(); track npc.id) {
                        <option [value]="npc.id">{{ npc.canonicalName }}</option>
                      }
                    </select>
                  </label>

                  <label class="compact-field">
                    <span>Alias in scene</span>
                    <input formControlName="aliasInScene" type="text" />
                  </label>

                  <label class="compact-field">
                    <span>Stance</span>
                    <select formControlName="stance">
                      <option value="">Unset</option>
                      <option value="hostile">Hostile</option>
                      <option value="guarded">Guarded</option>
                      <option value="neutral">Neutral</option>
                      <option value="curious">Curious</option>
                      <option value="supportive">Supportive</option>
                    </select>
                  </label>

                  <label class="compact-field">
                    <span>Local goal</span>
                    <input formControlName="localGoal" type="text" />
                  </label>

                  <label class="compact-field">
                    <span>Local secrets</span>
                    <textarea formControlName="localSecretsText" rows="3"></textarea>
                  </label>

                  <label class="compact-field">
                    <span>Notes</span>
                    <textarea formControlName="notesText" rows="3"></textarea>
                  </label>
                </div>
              </article>
            } @empty {
              <p class="empty-inline">No scene-specific NPCs linked yet.</p>
            }
          </div>
        </section>

        @if (scene()) {
          <section class="war-room-linked-section">
            <div class="war-room-section-head">
              <h4>Edges</h4>
            </div>

            <div class="entity-stack">
              <article class="mini-panel">
                <p class="eyebrow">Incoming</p>
                <div class="list-stack compact-stack">
                  @for (edge of incomingEdges(); track edge.id) {
                    <div class="list-row">
                      <span>{{ sceneLabel(edge.fromSceneId) }} → {{ sceneLabel(edge.toSceneId) }}</span>
                      <button type="button" class="button-outline micro-action button-danger" (click)="deleteEdge.emit({ edgeId: edge.id })">
                        Remove
                      </button>
                    </div>
                  } @empty {
                    <p class="empty-inline">No incoming edges.</p>
                  }
                </div>
              </article>

              <article class="mini-panel">
                <p class="eyebrow">Outgoing</p>
                <div class="list-stack compact-stack">
                  @for (edge of outgoingEdges(); track edge.id) {
                    <div class="list-row">
                      <span>{{ edge.label || edge.kind }} → {{ sceneLabel(edge.toSceneId) }}</span>
                      <button type="button" class="button-outline micro-action button-danger" (click)="deleteEdge.emit({ edgeId: edge.id })">
                        Remove
                      </button>
                    </div>
                  } @empty {
                    <p class="empty-inline">No outgoing edges.</p>
                  }
                </div>
              </article>

              <article class="mini-panel war-room-inline-panel" [formGroup]="edgeForm">
                <div class="war-room-inline-panel-head">
                  <strong>Add outgoing edge</strong>
                  <button type="button" class="button-outline micro-action" (click)="submitEdge()">Add edge</button>
                </div>

                <div class="war-room-form-grid two-up">
                  <label class="compact-field">
                    <span>To scene</span>
                    <select formControlName="toSceneId">
                      <option value="">Choose scene</option>
                      @for (target of availableEdgeTargets(); track target.id) {
                        <option [value]="target.id">{{ target.title }}</option>
                      }
                    </select>
                  </label>

                  <label class="compact-field">
                    <span>Kind</span>
                    <select formControlName="kind">
                      <option value="path">Path</option>
                      <option value="unlock">Unlock</option>
                      <option value="convergence">Convergence</option>
                      <option value="fallback">Fallback</option>
                    </select>
                  </label>

                  <label class="compact-field">
                    <span>Label</span>
                    <input formControlName="label" type="text" />
                  </label>

                  <label class="compact-field">
                    <span>Priority</span>
                    <input formControlName="priority" type="number" />
                  </label>
                </div>
              </article>
            </div>
          </section>
        }

        <div class="button-row war-room-form-actions">
          <button type="submit">{{ scene() ? 'Save node' : 'Create node' }}</button>
        </div>
      </form>
    </div>
  `,
})
export class CampaignNodeDrawerComponent {
  readonly scene = input<ResolvedSceneNode | null>(null);
  readonly scenes = input<ResolvedSceneNode[]>([]);
  readonly edges = input<SceneEdge[]>([]);
  readonly npcs = input<NPC[]>([]);
  readonly npcAppearances = input<NPCAppearance[]>([]);
  readonly locations = input<Location[]>([]);
  readonly goals = input<PCGoal[]>([]);
  readonly defaultStartSceneId = input<string | undefined>(undefined);
  readonly requiredBeatSceneIds = input<string[]>([]);

  readonly close = output<void>();
  readonly saveNode = output<SceneNodeUpsertInput>();
  readonly requestDeleteNode = output<string>();
  readonly createEdge = output<SceneEdgeCreateInput>();
  readonly deleteEdge = output<SceneEdgeDeleteInput>();

  readonly sceneKindOptions = Object.entries(SCENE_KIND_LABELS).map(([value, label]) => ({
    value: value as SceneKind,
    label,
  }));
  readonly classificationOptions = Object.entries(FLOW_NODE_CLASSIFICATION_LABELS).map(([value, label]) => ({
    value: value as FlowNodeClassification,
    label,
  }));
  readonly readinessOptions = Object.entries(FLOW_NODE_READINESS_LABELS).map(([value, label]) => ({
    value: value as FlowNodeReadiness,
    label,
  }));

  readonly form = new FormGroup({
    title: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    key: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    sceneKind: new FormControl<SceneKind>(DEFAULT_SCENE_KIND, { nonNullable: true }),
    classification: new FormControl<FlowNodeClassification>(DEFAULT_CLASSIFICATION, { nonNullable: true }),
    readiness: new FormControl<FlowNodeReadiness>(DEFAULT_READINESS, { nonNullable: true }),
    focus: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    summary: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    gmNote: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    hiddenTruth: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    note: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    tagsText: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    lane: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    boardX: new FormControl(0, { nonNullable: true }),
    boardY: new FormControl(0, { nonNullable: true }),
    isDefaultStartScene: new FormControl(false, { nonNullable: true }),
    isRequiredBeat: new FormControl(false, { nonNullable: true }),
    linkedLocationIds: new FormControl<string[]>([], { nonNullable: true }),
    linkedGoalIds: new FormControl<string[]>([], { nonNullable: true }),
    npcAppearances: new FormArray<FormGroup>([]),
  });

  readonly edgeForm = new FormGroup({
    toSceneId: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    kind: new FormControl<SceneEdge['kind']>('path', { nonNullable: true }),
    label: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    priority: new FormControl(DEFAULT_PRIORITY, { nonNullable: true }),
  });

  readonly incomingEdges = computed(() => {
    const scene = this.scene();
    return scene ? this.edges().filter((edge) => edge.toSceneId === scene.id) : [];
  });

  readonly outgoingEdges = computed(() => {
    const scene = this.scene();
    return scene ? this.edges().filter((edge) => edge.fromSceneId === scene.id) : [];
  });

  readonly availableEdgeTargets = computed(() => {
    const sceneId = this.scene()?.id;
    return this.scenes().filter((scene) => scene.id !== sceneId);
  });

  readonly selectedLocationIds = computed(() => this.form.controls.linkedLocationIds.value);
  readonly selectedGoalIds = computed(() => this.form.controls.linkedGoalIds.value);
  readonly drawerTitle = computed(() => (this.scene() ? 'Edit scene node' : 'Create scene node'));
  readonly drawerSubtitle = computed(() =>
    this.scene()
      ? 'Adjust the playable scene, links, and chapter placement from one drawer.'
      : 'Create a new playable scene or scene-cluster in the current chapter flow.',
  );

  get npcAppearanceForms(): FormArray<FormGroup> {
    return this.form.controls.npcAppearances;
  }

  constructor() {
    effect(() => {
      const scene = this.scene();
      this.resetForm(scene);
    });
  }

  toggleLocation(locationId: string): void {
    this.form.controls.linkedLocationIds.setValue(this.toggleId(this.form.controls.linkedLocationIds.value, locationId));
  }

  toggleGoal(goalId: string): void {
    this.form.controls.linkedGoalIds.setValue(this.toggleId(this.form.controls.linkedGoalIds.value, goalId));
  }

  addAppearance(): void {
    this.npcAppearanceForms.push(this.createAppearanceGroup());
  }

  removeAppearance(index: number): void {
    this.npcAppearanceForms.removeAt(index);
  }

  submitEdge(): void {
    const scene = this.scene();
    if (!scene) {
      return;
    }

    const toSceneId = this.edgeForm.controls.toSceneId.value;
    if (!toSceneId) {
      return;
    }

    this.createEdge.emit({
      fromSceneId: scene.id,
      toSceneId,
      kind: this.edgeForm.controls.kind.value,
      label: this.edgeForm.controls.label.value.trim() || undefined,
      priority: this.edgeForm.controls.priority.value,
    });
    this.edgeForm.reset({
      toSceneId: EMPTY_TEXT,
      kind: 'path',
      label: EMPTY_TEXT,
      priority: DEFAULT_PRIORITY,
    });
  }

  submit(): void {
    this.saveNode.emit({
      sceneNodeId: this.scene()?.id,
      title: this.form.controls.title.value,
      key: this.form.controls.key.value,
      sceneKind: this.form.controls.sceneKind.value,
      classification: this.form.controls.classification.value,
      readiness: this.form.controls.readiness.value,
      focus: this.form.controls.focus.value,
      summary: this.form.controls.summary.value,
      gmNote: this.form.controls.gmNote.value,
      hiddenTruth: this.form.controls.hiddenTruth.value,
      note: this.form.controls.note.value,
      tags: this.parseLines(this.form.controls.tagsText.value),
      board: {
        x: Number(this.form.controls.boardX.value) || 0,
        y: Number(this.form.controls.boardY.value) || 0,
        lane: this.form.controls.lane.value,
      },
      isDefaultStartScene: this.form.controls.isDefaultStartScene.value,
      isRequiredBeat: this.form.controls.isRequiredBeat.value,
      linkedLocationIds: this.form.controls.linkedLocationIds.value,
      linkedGoalIds: this.form.controls.linkedGoalIds.value,
      npcAppearances: this.npcAppearanceForms.controls.map((group) => this.serializeAppearance(group)),
    });
  }

  sceneLabel(sceneId: string): string {
    return this.scenes().find((scene) => scene.id === sceneId)?.title ?? 'Unknown scene';
  }

  private resetForm(scene: ResolvedSceneNode | null): void {
    const summary = scene?.resolvedContent.summaryBlocks[0]?.text ?? EMPTY_TEXT;
    const gmNote = scene?.resolvedContent.gmBlocks[0]?.text ?? EMPTY_TEXT;
    const hiddenTruth = scene?.resolvedContent.hiddenTruthBlocks[0]?.text ?? EMPTY_TEXT;
    const note = scene?.resolvedContent.noteBlocks[0]?.text ?? EMPTY_TEXT;
    this.form.reset({
      title: scene?.title ?? EMPTY_TEXT,
      key: scene?.key ?? EMPTY_TEXT,
      sceneKind: scene?.sceneKind ?? DEFAULT_SCENE_KIND,
      classification: scene?.resolvedPlanning.classification ?? DEFAULT_CLASSIFICATION,
      readiness: scene?.resolvedPlanning.readiness ?? DEFAULT_READINESS,
      focus: scene?.resolvedPlanning.focus ?? EMPTY_TEXT,
      summary,
      gmNote,
      hiddenTruth,
      note,
      tagsText: (scene?.tags ?? []).join(', '),
      lane: scene?.board.lane ?? EMPTY_TEXT,
      boardX: scene?.board.x ?? 0,
      boardY: scene?.board.y ?? 0,
      isDefaultStartScene: this.defaultStartSceneId() === scene?.id,
      isRequiredBeat: scene ? this.requiredBeatSceneIds().includes(scene.id) : false,
      linkedLocationIds: [...(scene?.linkedLocationIds ?? [])],
      linkedGoalIds: [...(scene?.linkedGoalIds ?? [])],
    });
    this.npcAppearanceForms.clear();
    for (const appearanceId of scene?.linkedNpcAppearanceIds ?? []) {
      const appearance = this.sceneAppearanceById(appearanceId);
      this.npcAppearanceForms.push(this.createAppearanceGroup(appearance));
    }
  }

  private sceneAppearanceById(appearanceId: string): SceneNpcAppearanceInput | null {
    const appearance = this.npcAppearances().find((entry) => entry.id === appearanceId);
    if (!appearance) {
      return null;
    }

    return {
      appearanceId: appearance.id,
      npcId: appearance.npcId,
      aliasInScene: appearance.aliasInScene,
      stance: appearance.stance,
      localGoal: appearance.localGoal,
      localSecrets: appearance.localSecrets.map((block) => block.text),
      portrayalOverride: appearance.portrayalOverride.map((block) => block.text),
      notes: appearance.notes.map((block) => block.text),
    };
  }

  private createAppearanceGroup(appearance?: SceneNpcAppearanceInput | null): FormGroup {
    return new FormGroup({
      appearanceId: new FormControl(appearance?.appearanceId ?? EMPTY_TEXT, { nonNullable: true }),
      npcId: new FormControl(appearance?.npcId ?? EMPTY_TEXT, { nonNullable: true }),
      aliasInScene: new FormControl(appearance?.aliasInScene ?? EMPTY_TEXT, { nonNullable: true }),
      stance: new FormControl<AppearanceFormValue['stance']>(appearance?.stance ?? '', { nonNullable: true }),
      localGoal: new FormControl(appearance?.localGoal ?? EMPTY_TEXT, { nonNullable: true }),
      localSecretsText: new FormControl((appearance?.localSecrets ?? []).join('\n'), { nonNullable: true }),
      portrayalOverrideText: new FormControl((appearance?.portrayalOverride ?? []).join('\n'), { nonNullable: true }),
      notesText: new FormControl((appearance?.notes ?? []).join('\n'), { nonNullable: true }),
    });
  }

  private serializeAppearance(group: FormGroup): SceneNpcAppearanceInput {
    const raw = group.getRawValue() as AppearanceFormValue;
    return {
      appearanceId: raw.appearanceId || undefined,
      npcId: raw.npcId,
      aliasInScene: raw.aliasInScene,
      stance: raw.stance || undefined,
      localGoal: raw.localGoal,
      localSecrets: this.parseLines(raw.localSecretsText),
      portrayalOverride: this.parseLines(raw.portrayalOverrideText),
      notes: this.parseLines(raw.notesText),
    };
  }

  private parseLines(value: string): string[] {
    return value
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  private toggleId(current: string[], value: string): string[] {
    return current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
  }
}
