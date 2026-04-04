import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  GoalUpsertInput,
  Location,
  LocationUpsertInput,
  NpcUpsertInput,
  ResolvedSceneNode,
  SceneEdgeCreateInput,
  SceneNodeDeletePreview,
  SceneNodeStatus,
  SceneNodeUpsertInput,
  resolveLayered,
} from '@shared/domain';
import { map, startWith } from 'rxjs';
import { CampaignConsoleStore } from './campaign-console.store';
import { CampaignGoalDrawerComponent } from './campaign-goal-drawer.component';
import { CampaignLocationDrawerComponent } from './campaign-location-drawer.component';
import { CampaignNodeDrawerComponent } from './campaign-node-drawer.component';
import { CampaignNpcDrawerComponent } from './campaign-npc-drawer.component';
import {
  buildConnectedSceneEntries,
  buildFlowLaneSummaries,
  buildLinkedNpcEntries,
  buildNodeSearchText,
  FLOW_NODE_CLASSIFICATION_LABELS,
  FLOW_NODE_READINESS_LABELS,
  LinkedNpcEntry,
  isGoalLinkedToScene,
  SCENE_KIND_LABELS,
  SCENE_STATUS_LABELS,
  SCENE_STATUS_MUTATION_ORDER,
  sceneFocusText as buildSceneFocusText,
  sceneGridColumn as buildSceneGridColumn,
  sceneGridRow as buildSceneGridRow,
  sceneProgressLabel as buildSceneProgressLabel,
} from './campaign-console-planning.helpers';

const EMPTY_SEARCH = '';
const EMPTY_NOTE = '';
const ENTITY_DELETE_COPY = 'Delete this shared record and unlink it from War Room scenes?';

type AuthoringDrawerKind = 'node' | 'npc' | 'location' | 'goal';

@Component({
  selector: 'app-campaign-console-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    CampaignNodeDrawerComponent,
    CampaignNpcDrawerComponent,
    CampaignLocationDrawerComponent,
    CampaignGoalDrawerComponent,
  ],
  template: `
    @if (store.consoleData(); as data) {
      <section class="campaign-planning-header card engraved-panel">
        <div class="route-heading">
          <p class="eyebrow">War Room</p>
          <h2>{{ data.campaign.title }} flow planning</h2>
          <p>{{ chapterSummary() }}</p>
        </div>

        <div class="planning-header-strip">
          <article class="planning-chip">
            <span class="stat-label">Active chapter</span>
            <strong>{{ data.board.chapter.title }}</strong>
          </article>
          <article class="planning-chip">
            <span class="stat-label">Nodes</span>
            <strong>{{ data.board.nodes.length }}</strong>
          </article>
          <article class="planning-chip">
            <span class="stat-label">Ready</span>
            <strong>{{ readyNodeCount() }}</strong>
          </article>
          <article class="planning-chip">
            <span class="stat-label">Visited</span>
            <strong>{{ visitedNodeCount() }}</strong>
          </article>
        </div>
      </section>

      <div class="planning-workspace">
        <section class="card flow-canvas-panel engraved-panel">
          <div class="flow-toolbar">
            <div class="flow-toolbar-copy">
              <p class="eyebrow">Flow View</p>
              <h3>Chapter backbone</h3>
            </div>

            <div class="flow-toolbar-actions">
              <label class="compact-field flow-search-field">
                <span>Search nodes</span>
                <input [formControl]="searchControl" type="search" placeholder="scene, npc, goal, clue..." />
              </label>

              <div class="button-row wrap-row">
                <button type="button" class="button-outline micro-action" (click)="openCreateNodeDrawer()">Create node</button>
                <button type="button" class="button-outline micro-action" (click)="openDrawer('npc')">NPCs</button>
                <button type="button" class="button-outline micro-action" (click)="openDrawer('location')">Locations</button>
                <button type="button" class="button-outline micro-action" (click)="openDrawer('goal')">Goals</button>
              </div>
            </div>
          </div>

          <div class="flow-lane-strip">
            @for (lane of laneSummaries(); track lane.key) {
              <article class="lane-chip">
                <strong>{{ lane.label }}</strong>
                <span>{{ lane.count }} nodes</span>
              </article>
            }
          </div>

          <div class="flow-map">
            @for (node of filteredNodes(); track node.id) {
              <button
                type="button"
                class="flow-node"
                [class.flow-node-selected]="selectedSceneId() === node.id"
                [class.flow-node-active]="node.state.status === 'active'"
                [class.flow-node-completed]="node.state.status === 'completed'"
                [class.flow-node-locked]="node.state.status === 'locked'"
                [class.flow-node-hub]="node.resolvedPlanning.classification === 'hub'"
                [style.grid-column]="sceneGridColumn(node)"
                [style.grid-row]="sceneGridRow(node)"
                (click)="selectScene(node.id)"
              >
                <div class="flow-node-meta">
                  <span class="tag-chip">{{ sceneStatusLabel(node.state.status) }}</span>
                  <span class="tag-chip">{{ classificationLabel(node) }}</span>
                  <span class="tag-chip">{{ readinessLabel(node) }}</span>
                </div>

                <div class="flow-node-copy">
                  <p class="flow-node-kind">{{ sceneKindLabel(node) }}</p>
                  <h4>{{ node.title }}</h4>
                  <p>{{ node.resolvedContent.summaryBlocks[0]?.text }}</p>
                </div>

                <div class="flow-node-foot">
                  <span>{{ sceneProgressLabel(node) }}</span>
                  <span>{{ linkedContextLabel(node) }}</span>
                </div>
              </button>
            }
          </div>

          <div class="flow-edge-ledger">
            @for (edge of data.board.edges; track edge.id) {
              <span class="tag-chip">
                {{ sceneTitle(edge.fromSceneId) }} → {{ sceneTitle(edge.toSceneId) }}
              </span>
            }
          </div>
        </section>

        <aside class="card flow-inspector engraved-panel">
          @if (selectedScene(); as scene) {
            <div class="flow-inspector-header">
              <div>
                <p class="eyebrow">Selected node</p>
                <h3>{{ scene.title }}</h3>
                <p class="inspector-subline">
                  {{ sceneKindLabel(scene) }} · {{ classificationLabel(scene) }} · {{ readinessLabel(scene) }}
                </p>
              </div>

              <div class="button-row wrap-row">
                <button type="button" class="button-outline micro-action" (click)="openEditNodeDrawer(scene.id)">Edit node</button>
                <a class="button-outline micro-action" [routerLink]="sceneRoute(scene.id)">Open scene</a>
                @for (status of sceneStatusOptions; track status) {
                  <button
                    type="button"
                    class="button-outline micro-action"
                    [class.status-action-active]="scene.state.status === status"
                    (click)="setSceneStatus(status)"
                  >
                    {{ sceneStatusLabel(status) }}
                  </button>
                }
              </div>
            </div>

            <section class="inspector-section inspector-focus-panel">
              <div class="inspector-section-head">
                <p class="eyebrow">Focus</p>
                <span class="tag-chip">{{ sceneProgressLabel(scene) }}</span>
              </div>
              <h4>{{ sceneFocusText(scene) }}</h4>
              <p>{{ scene.resolvedContent.gmBlocks[0]?.text || scene.resolvedContent.summaryBlocks[0]?.text }}</p>
            </section>

            <section class="inspector-section">
              <div class="inspector-section-head">
                <p class="eyebrow">Scene frame</p>
                <span class="tag-chip">{{ outcomeCount(scene) }} outcomes</span>
              </div>

              <div class="inspector-copy-grid">
                <article class="inspector-copy-card">
                  <p class="eyebrow">Summary</p>
                  @for (block of scene.resolvedContent.summaryBlocks; track block.id) {
                    <p>{{ block.text }}</p>
                  }
                </article>
                <article class="inspector-copy-card">
                  <p class="eyebrow">GM notes</p>
                  @for (block of scene.resolvedContent.noteBlocks; track block.id) {
                    <p>{{ block.text }}</p>
                  } @empty {
                    <p>{{ scene.resolvedContent.gmBlocks[0]?.text || 'No extra prep note written.' }}</p>
                  }
                </article>
              </div>
            </section>

            <section class="inspector-section">
              <div class="inspector-section-head">
                <p class="eyebrow">Connected context</p>
                <span class="tag-chip">{{ linkedNpcCards().length + linkedGoals().length + linkedLocations().length }} links</span>
              </div>

              <div class="context-columns">
                <article class="mini-panel">
                  <p class="eyebrow">NPCs</p>
                  <div class="list-stack compact-stack">
                    @for (card of linkedNpcCards(); track card.appearance?.id ?? card.npc.id) {
                      <article class="context-row">
                        <strong>{{ npcLabel(card) }}</strong>
                        <p>{{ card.summary }}</p>
                        @if (card.appearance?.localGoal) {
                          <span class="tag-chip">{{ card.appearance?.localGoal }}</span>
                        }
                      </article>
                    } @empty {
                      <p class="empty-inline">No linked NPCs.</p>
                    }
                  </div>
                </article>

                <article class="mini-panel">
                  <p class="eyebrow">Goals</p>
                  <div class="list-stack compact-stack">
                    @for (goal of linkedGoals(); track goal.id) {
                      <article class="context-row">
                        <strong>{{ goal.title }}</strong>
                        <p>{{ goal.ownerLabel }} · {{ goal.description }}</p>
                        <span class="tag-chip">{{ goal.progressState }}</span>
                      </article>
                    } @empty {
                      <p class="empty-inline">No linked PC goals.</p>
                    }
                  </div>
                </article>

                <article class="mini-panel">
                  <p class="eyebrow">Locations</p>
                  <div class="list-stack compact-stack">
                    @for (location of linkedLocations(); track location.id) {
                      <article class="context-row">
                        <strong>{{ location.name }}</strong>
                        <p>{{ locationSummary(location) }}</p>
                      </article>
                    } @empty {
                      <p class="empty-inline">No linked locations.</p>
                    }
                  </div>
                </article>
              </div>
            </section>

            <section class="inspector-section">
              <div class="inspector-section-head">
                <p class="eyebrow">Connected nodes</p>
                <span class="tag-chip">{{ connectedScenes().length }} links</span>
              </div>

              <div class="list-stack compact-stack">
                @for (entry of connectedScenes(); track entry.edgeId) {
                  <button type="button" class="connected-node-row" (click)="selectScene(entry.scene.id)">
                    <div>
                      <strong>{{ entry.scene.title }}</strong>
                      <p>{{ entry.direction === 'outgoing' ? 'Next' : 'From' }} · {{ sceneKindLabel(entry.scene) }}</p>
                    </div>
                    <div class="connected-node-meta">
                      <span class="tag-chip">{{ entry.label }}</span>
                      <span class="tag-chip">{{ sceneStatusLabel(entry.scene.state.status) }}</span>
                    </div>
                  </button>
                } @empty {
                  <article class="mini-panel">
                    <p class="empty-inline">No explicit connections from this node.</p>
                  </article>
                }
              </div>
            </section>

            <section class="inspector-section">
              <div class="inspector-section-head">
                <p class="eyebrow">Runtime capture</p>
                <span class="tag-chip">{{ scene.state.localNotes.length }} notes</span>
              </div>

              @if (scene.state.localNotes.length) {
                <div class="linked-strip runtime-note-strip">
                  @for (note of scene.state.localNotes; track note) {
                    <article class="mini-panel">
                      <p>{{ note }}</p>
                    </article>
                  }
                </div>
              }

              <label class="compact-field">
                <span>Quick note</span>
                <textarea [formControl]="quickNoteControl" rows="3" placeholder="Capture what changed at the table..."></textarea>
              </label>

              <div class="button-row">
                <button type="button" (click)="submitQuickNote()">Add note</button>
              </div>
            </section>
          } @else {
            <section class="empty-card planning-empty-state">
              <p class="eyebrow">Flow Inspector</p>
              <h3>Pick a node from the chapter flow</h3>
              <p>The canvas stays clean. The inspector is where the prep, context, and quick runtime notes come into focus.</p>
            </section>
          }
        </aside>
      </div>

      @if (drawerKind(); as activeDrawer) {
        <div class="war-room-drawer-backdrop" (click)="closeDrawer()"></div>
        <section class="war-room-drawer card engraved-panel">
          @switch (activeDrawer) {
            @case ('node') {
              <app-campaign-node-drawer
                [scene]="editedScene()"
                [scenes]="data.board.nodes"
                [edges]="data.board.edges"
                [npcs]="data.npcs"
                [npcAppearances]="data.npcAppearances"
                [locations]="data.locations"
                [goals]="data.pcGoals"
                [defaultStartSceneId]="data.board.chapter.defaultStartSceneId"
                [requiredBeatSceneIds]="data.board.chapter.requiredBeatSceneIds"
                (close)="closeDrawer()"
                (saveNode)="saveNode($event)"
                (requestDeleteNode)="openDeletePreview($event)"
                (createEdge)="createEdge($event)"
                (deleteEdge)="deleteEdge($event.edgeId)"
              />
            }
            @case ('npc') {
              <app-campaign-npc-drawer
                [npcs]="data.npcs"
                (close)="closeDrawer()"
                (saveNpc)="saveNpc($event)"
                (requestDelete)="deleteNpc($event)"
              />
            }
            @case ('location') {
              <app-campaign-location-drawer
                [locations]="data.locations"
                (close)="closeDrawer()"
                (saveLocation)="saveLocation($event)"
                (requestDelete)="deleteLocation($event)"
              />
            }
            @case ('goal') {
              <app-campaign-goal-drawer
                [goals]="data.pcGoals"
                [scenes]="data.board.nodes"
                [npcs]="data.npcs"
                (close)="closeDrawer()"
                (saveGoal)="saveGoal($event)"
                (requestDelete)="deleteGoal($event)"
              />
            }
          }
        </section>
      }

      @if (deletePreview(); as preview) {
        <div class="confirm-modal-backdrop" (click)="cancelDeletePreview()"></div>
        <section class="confirm-modal card engraved-panel" role="dialog" aria-modal="true" aria-labelledby="war-room-delete-title">
          <div class="card-header">
            <div class="section-heading">
              <h3 id="war-room-delete-title">Delete {{ preview.sceneTitle }}?</h3>
              <p>This cascades through scene-owned War Room records.</p>
            </div>
          </div>

          <div class="war-room-delete-summary">
            <p>{{ preview.connectedEdgeCount }} connected edges</p>
            <p>{{ preview.sceneStateCount }} scene states</p>
            <p>{{ preview.hookCount }} hooks</p>
            <p>{{ preview.outcomeCount }} outcomes</p>
            <p>{{ preview.endeavorCount }} endeavors</p>
            <p>{{ preview.obstacleCount }} obstacles</p>
            <p>{{ preview.endeavorRunCount }} endeavor runs</p>
            <p>{{ preview.encounterCount }} encounters</p>
            <p>{{ preview.npcAppearanceCount }} NPC appearances</p>
          </div>

          <div class="button-row">
            <button type="button" class="button-outline" (click)="cancelDeletePreview()">Cancel</button>
            <button type="button" class="button-danger" (click)="confirmDeleteNode()">Delete everything</button>
          </div>
        </section>
      }
    } @else {
      <section class="card engraved-panel empty-card">Loading the campaign flow…</section>
    }
  `,
  styleUrl: './campaign-console-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignConsolePageComponent {
  readonly store = inject(CampaignConsoleStore);
  private readonly route = inject(ActivatedRoute);

  readonly searchControl = new FormControl(EMPTY_SEARCH, { nonNullable: true });
  readonly quickNoteControl = new FormControl(EMPTY_NOTE, { nonNullable: true });
  readonly selectedSceneId = signal(EMPTY_SEARCH);
  readonly drawerKind = signal<AuthoringDrawerKind | null>(null);
  readonly editingSceneId = signal<string | null>(null);
  readonly deletePreview = signal<SceneNodeDeletePreview | null>(null);
  readonly sceneStatusOptions = SCENE_STATUS_MUTATION_ORDER;

  private readonly routeCampaignId = toSignal(
    this.route.paramMap.pipe(
      map((params) => params.get('campaignId') ?? EMPTY_SEARCH),
      startWith(this.route.snapshot.paramMap.get('campaignId') ?? EMPTY_SEARCH),
    ),
    { initialValue: this.route.snapshot.paramMap.get('campaignId') ?? EMPTY_SEARCH },
  );

  private readonly searchQuery = toSignal(this.searchControl.valueChanges.pipe(startWith(this.searchControl.value)), {
    initialValue: this.searchControl.value,
  });

  readonly filteredNodes = computed(() => {
    const data = this.store.consoleData();
    if (!data) {
      return [] as ResolvedSceneNode[];
    }

    const query = this.searchQuery().trim().toLowerCase();
    return query ? data.board.nodes.filter((node) => buildNodeSearchText(node).includes(query)) : data.board.nodes;
  });

  readonly selectedScene = computed(() => {
    const data = this.store.consoleData();
    const selectedSceneId = this.selectedSceneId();
    return data && selectedSceneId ? (data.sceneIndex[selectedSceneId] ?? null) : null;
  });

  readonly editedScene = computed(() => {
    const data = this.store.consoleData();
    const editingSceneId = this.editingSceneId();
    return data && editingSceneId ? (data.sceneIndex[editingSceneId] ?? null) : null;
  });

  readonly laneSummaries = computed(() => {
    const data = this.store.consoleData();
    return data ? buildFlowLaneSummaries(data.board.nodes) : [];
  });

  readonly linkedNpcCards = computed(() => {
    const scene = this.selectedScene();
    const data = this.store.consoleData();
    return scene && data ? buildLinkedNpcEntries(scene, data.npcs, data.npcAppearances) : ([] as LinkedNpcEntry[]);
  });

  readonly linkedGoals = computed(() => {
    const scene = this.selectedScene();
    const data = this.store.consoleData();
    return scene && data ? data.pcGoals.filter((goal) => isGoalLinkedToScene(goal, scene)) : [];
  });

  readonly linkedLocations = computed(() => {
    const scene = this.selectedScene();
    const data = this.store.consoleData();
    return scene && data ? data.locations.filter((location) => scene.linkedLocationIds.includes(location.id)) : ([] as Location[]);
  });

  readonly linkedOutcomes = computed(() => {
    const scene = this.selectedScene();
    const data = this.store.consoleData();
    return scene && data ? data.outcomes.filter((outcome) => scene.outcomeIds.includes(outcome.id)) : [];
  });

  readonly connectedScenes = computed(() => {
    const scene = this.selectedScene();
    const data = this.store.consoleData();
    return scene && data ? buildConnectedSceneEntries(scene, data.board.edges, data.sceneIndex) : [];
  });

  readonly readyNodeCount = computed(() => {
    const data = this.store.consoleData();
    return data ? data.board.nodes.filter((node) => node.resolvedPlanning.readiness === 'ready').length : 0;
  });

  readonly visitedNodeCount = computed(() => {
    const data = this.store.consoleData();
    return data ? data.board.nodes.filter((node) => node.state.status === 'completed').length : 0;
  });

  constructor() {
    effect(() => {
      const campaignId = this.routeCampaignId();
      if (campaignId) {
        void this.store.loadConsole(campaignId);
      }
    });

    effect(() => {
      const data = this.store.consoleData();
      if (!data) {
        return;
      }

      const selectedSceneId = this.selectedSceneId();
      if (selectedSceneId && data.sceneIndex[selectedSceneId]) {
        return;
      }

      const fallbackSceneId =
        data.board.activeSceneId ??
        data.board.chapter.defaultStartSceneId ??
        data.board.nodes[0]?.id ??
        EMPTY_SEARCH;
      untracked(() => this.selectedSceneId.set(fallbackSceneId));
    });

    effect(() => {
      const data = this.store.consoleData();
      const editingSceneId = this.editingSceneId();
      if (!data || !editingSceneId || data.sceneIndex[editingSceneId]) {
        return;
      }
      untracked(() => {
        this.editingSceneId.set(null);
        if (this.drawerKind() === 'node') {
          this.drawerKind.set(null);
        }
      });
    });
  }

  selectScene(sceneId: string): void {
    this.selectedSceneId.set(sceneId);
  }

  openDrawer(kind: AuthoringDrawerKind): void {
    this.drawerKind.set(kind);
    if (kind !== 'node') {
      this.editingSceneId.set(null);
    }
  }

  openCreateNodeDrawer(): void {
    this.editingSceneId.set(null);
    this.drawerKind.set('node');
  }

  openEditNodeDrawer(sceneId: string): void {
    this.editingSceneId.set(sceneId);
    this.drawerKind.set('node');
  }

  closeDrawer(): void {
    this.drawerKind.set(null);
    this.editingSceneId.set(null);
  }

  sceneRoute(sceneId: string): string[] {
    return ['/gm/campaigns', this.routeCampaignId(), 'scenes', sceneId];
  }

  sceneGridColumn(node: ResolvedSceneNode): string {
    return buildSceneGridColumn(node);
  }

  sceneGridRow(node: ResolvedSceneNode): string {
    return buildSceneGridRow(node);
  }

  sceneKindLabel(node: ResolvedSceneNode): string {
    return SCENE_KIND_LABELS[node.sceneKind];
  }

  sceneStatusLabel(status: SceneNodeStatus): string {
    return SCENE_STATUS_LABELS[status];
  }

  classificationLabel(node: ResolvedSceneNode): string {
    return FLOW_NODE_CLASSIFICATION_LABELS[node.resolvedPlanning.classification];
  }

  readinessLabel(node: ResolvedSceneNode): string {
    return FLOW_NODE_READINESS_LABELS[node.resolvedPlanning.readiness];
  }

  sceneProgressLabel(node: ResolvedSceneNode): string {
    const data = this.store.consoleData();
    return data ? buildSceneProgressLabel(node, data.board.chapter) : 'Branch';
  }

  sceneFocusText(node: ResolvedSceneNode): string {
    return buildSceneFocusText(node);
  }

  linkedContextLabel(node: ResolvedSceneNode): string {
    const linkedCount = node.linkedNpcAppearanceIds.length + node.linkedLocationIds.length + (node.linkedGoalIds?.length ?? 0);
    return `${linkedCount} linked`;
  }

  npcLabel(card: LinkedNpcEntry): string {
    return card.appearance?.aliasInScene || card.npc.canonicalName;
  }

  locationSummary(location: Location): string {
    const resolved = resolveLayered(location.content);
    return resolved.publicSummary[0]?.text ?? resolved.gmTruth[0]?.text ?? 'No location summary yet.';
  }

  sceneTitle(sceneId: string): string {
    return this.store.consoleData()?.sceneIndex[sceneId]?.title ?? 'Unknown scene';
  }

  chapterSummary(): string {
    const data = this.store.consoleData();
    return data?.board.chapter.content.source?.value.summaryBlocks[0]?.text ?? 'No chapter summary yet.';
  }

  outcomeCount(scene: ResolvedSceneNode): number {
    return scene.outcomeIds.length;
  }

  async setSceneStatus(status: Extract<SceneNodeStatus, 'available' | 'active' | 'completed' | 'skipped'>): Promise<void> {
    const campaignId = this.routeCampaignId();
    const scene = this.selectedScene();
    if (!campaignId || !scene || scene.state.status === status) {
      return;
    }
    await this.store.updateSceneState(campaignId, { sceneNodeId: scene.id, status });
  }

  async submitQuickNote(): Promise<void> {
    const campaignId = this.routeCampaignId();
    const scene = this.selectedScene();
    const text = this.quickNoteControl.value.trim();
    if (!campaignId || !scene || !text) {
      return;
    }
    await this.store.addQuickNote(campaignId, { text, sceneNodeId: scene.id });
    this.quickNoteControl.setValue(EMPTY_NOTE);
  }

  async saveNode(input: SceneNodeUpsertInput): Promise<void> {
    const campaignId = this.routeCampaignId();
    if (!campaignId) {
      return;
    }
    const data = await this.store.upsertSceneNode(campaignId, input);
    const savedSceneId = data.board.nodes.find((node) => node.key === input.key)?.id ?? input.sceneNodeId ?? EMPTY_SEARCH;
    if (savedSceneId) {
      this.selectedSceneId.set(savedSceneId);
      this.editingSceneId.set(savedSceneId);
    }
  }

  async createEdge(input: SceneEdgeCreateInput): Promise<void> {
    const campaignId = this.routeCampaignId();
    if (campaignId) {
      await this.store.createSceneEdge(campaignId, input);
    }
  }

  async deleteEdge(edgeId: string): Promise<void> {
    const campaignId = this.routeCampaignId();
    if (campaignId) {
      await this.store.deleteSceneEdge(campaignId, { edgeId });
    }
  }

  async openDeletePreview(sceneId: string): Promise<void> {
    const campaignId = this.routeCampaignId();
    if (!campaignId) {
      return;
    }
    this.deletePreview.set(await this.store.previewSceneDelete(campaignId, sceneId));
  }

  cancelDeletePreview(): void {
    this.deletePreview.set(null);
  }

  async confirmDeleteNode(): Promise<void> {
    const campaignId = this.routeCampaignId();
    const preview = this.deletePreview();
    if (!campaignId || !preview) {
      return;
    }
    await this.store.deleteSceneNode(campaignId, { sceneNodeId: preview.sceneNodeId });
    this.deletePreview.set(null);
    this.closeDrawer();
  }

  async saveNpc(input: NpcUpsertInput): Promise<void> {
    const campaignId = this.routeCampaignId();
    if (campaignId) {
      await this.store.upsertNpc(campaignId, input);
    }
  }

  async deleteNpc(npcId: string): Promise<void> {
    const campaignId = this.routeCampaignId();
    if (!campaignId || !window.confirm(ENTITY_DELETE_COPY)) {
      return;
    }
    await this.store.deleteNpc(campaignId, { npcId });
  }

  async saveLocation(input: LocationUpsertInput): Promise<void> {
    const campaignId = this.routeCampaignId();
    if (campaignId) {
      await this.store.upsertLocation(campaignId, input);
    }
  }

  async deleteLocation(locationId: string): Promise<void> {
    const campaignId = this.routeCampaignId();
    if (!campaignId || !window.confirm(ENTITY_DELETE_COPY)) {
      return;
    }
    await this.store.deleteLocation(campaignId, { locationId });
  }

  async saveGoal(input: GoalUpsertInput): Promise<void> {
    const campaignId = this.routeCampaignId();
    if (campaignId) {
      await this.store.upsertGoal(campaignId, input);
    }
  }

  async deleteGoal(goalId: string): Promise<void> {
    const campaignId = this.routeCampaignId();
    if (!campaignId || !window.confirm(ENTITY_DELETE_COPY)) {
      return;
    }
    await this.store.deleteGoal(campaignId, { goalId });
  }
}
