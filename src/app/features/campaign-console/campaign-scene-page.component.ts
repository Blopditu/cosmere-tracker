import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Location, ResolvedSceneNode, SceneNodeStatus, resolveLayered, StageScene } from '@shared/domain';
import { map, startWith } from 'rxjs';
import { SessionStoreService } from '../../core/session-store.service';
import { CampaignConsoleStore } from './campaign-console.store';
import {
  buildConnectedSceneEntries,
  buildLinkedNpcEntries,
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
} from './campaign-console-planning.helpers';

const EMPTY_VALUE = '';
const YOUTUBE_THUMBNAIL_TEMPLATE = 'https://img.youtube.com/vi/%s/hqdefault.jpg';

function extractYoutubeVideoId(url: string | undefined): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.split('/').filter(Boolean)[0] ?? null;
    }

    if (parsed.hostname.includes('youtube.com')) {
      return parsed.searchParams.get('v');
    }
  } catch {
    return null;
  }

  return null;
}

function youtubeThumbnailUrl(url: string | undefined): string | null {
  const videoId = extractYoutubeVideoId(url);
  return videoId ? YOUTUBE_THUMBNAIL_TEMPLATE.replace('%s', videoId) : null;
}

@Component({
  selector: 'app-campaign-scene-page',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    @if (store.consoleData(); as data) {
      @if (scene(); as activeScene) {
        <section class="campaign-scene-header card engraved-panel">
          <div class="scene-header-copy">
            <div class="button-row wrap-row">
              <a class="button-outline micro-action" [routerLink]="flowRoute()">Back to flow</a>
              <span class="tag-chip">{{ sceneStatusLabel(activeScene.state.status) }}</span>
              <span class="tag-chip">{{ classificationLabel(activeScene) }}</span>
              <span class="tag-chip">{{ readinessLabel(activeScene) }}</span>
            </div>
            <p class="eyebrow">Scene View</p>
            <h2>{{ activeScene.title }}</h2>
            <p>{{ sceneFocusText(activeScene) }}</p>
          </div>

          <div class="scene-header-meta">
            <article class="scene-header-chip">
              <span class="stat-label">Type</span>
              <strong>{{ sceneKindLabel(activeScene) }}</strong>
            </article>
            <article class="scene-header-chip">
              <span class="stat-label">Outcomes</span>
              <strong>{{ linkedOutcomes().length }}</strong>
            </article>
            <article class="scene-header-chip">
              <span class="stat-label">Context</span>
              <strong>{{ linkedNpcCards().length + linkedGoals().length + linkedLocations().length }}</strong>
            </article>
            <article class="scene-header-chip">
              <span class="stat-label">Stage target</span>
              <strong>{{ activeSessionLabel() }}</strong>
            </article>
          </div>
        </section>

        <section class="scene-minimap card engraved-panel">
          <div class="card-header">
            <div class="section-heading">
              <h3>Flow minimap</h3>
              <p>{{ data.board.chapter.title }}</p>
            </div>
          </div>

          <div class="scene-minimap-grid">
            @for (node of data.board.nodes; track node.id) {
              <a
                class="scene-minimap-node"
                [class.scene-minimap-node-active]="node.id === activeScene.id"
                [class.scene-minimap-node-visited]="node.state.status === 'completed'"
                [class.scene-minimap-node-locked]="node.state.status === 'locked'"
                [style.grid-column]="sceneGridColumn(node)"
                [style.grid-row]="sceneGridRow(node)"
                [routerLink]="sceneRoute(node.id)"
              >
                <strong>{{ node.title }}</strong>
                <span>{{ sceneStatusLabel(node.state.status) }}</span>
              </a>
            }
          </div>
        </section>

        <div class="scene-workspace">
          <section class="scene-core card engraved-panel">
            <div class="scene-core-stack">
              <section class="scene-panel scene-panel-intent">
                <div class="scene-panel-head">
                  <p class="eyebrow">Intent</p>
                  <span class="tag-chip">{{ sceneKindLabel(activeScene) }}</span>
                </div>
                <h3>{{ sceneFocusText(activeScene) }}</h3>
                <p>{{ activeScene.resolvedContent.summaryBlocks[0]?.text }}</p>
              </section>

              <section class="scene-panel">
                <div class="scene-panel-head">
                  <p class="eyebrow">Approaches</p>
                  <span class="tag-chip">{{ sceneApproaches().length }}</span>
                </div>
                <div class="scene-approach-list">
                  @for (approach of sceneApproaches(); track approach.id) {
                    <article class="approach-card">
                      <div class="approach-card-head">
                        <strong>{{ approach.title }}</strong>
                        <span class="tag-chip">{{ approach.kind }}</span>
                      </div>
                      <p>{{ approach.summary }}</p>
                    </article>
                  } @empty {
                    <article class="approach-card">
                      <strong>No explicit approaches yet</strong>
                      <p>Use the scene summary and linked NPCs to improvise the route through this node.</p>
                    </article>
                  }
                </div>
              </section>

              <section class="scene-panel">
                <div class="scene-panel-head">
                  <p class="eyebrow">Key info</p>
                  <span class="tag-chip">{{ activeScene.resolvedContent.hiddenTruthBlocks.length }}</span>
                </div>
                <div class="scene-copy-columns">
                  <article class="scene-copy-card">
                    <p class="eyebrow">Summary</p>
                    @for (block of activeScene.resolvedContent.summaryBlocks; track block.id) {
                      <p>{{ block.text }}</p>
                    }
                  </article>
                  <article class="scene-copy-card emphasis-card">
                    <p class="eyebrow">Truth / key info</p>
                    @for (block of activeScene.resolvedContent.hiddenTruthBlocks; track block.id) {
                      <p>{{ block.text }}</p>
                    } @empty {
                      <p>{{ activeScene.resolvedContent.gmBlocks[0]?.text || 'No extra key truth written for this node.' }}</p>
                    }
                  </article>
                </div>
              </section>

              <section class="scene-panel">
                <div class="scene-panel-head">
                  <p class="eyebrow">Outcomes</p>
                  <span class="tag-chip">{{ activeScene.state.chosenOutcomeIds.length }} chosen</span>
                </div>
                <div class="scene-outcome-grid">
                  @for (outcome of linkedOutcomes(); track outcome.id) {
                    <button
                      type="button"
                      class="scene-outcome-card"
                      [class.scene-outcome-card-selected]="isOutcomeSelected(outcome.id)"
                      (click)="toggleOutcome(outcome.id)"
                    >
                      <strong>{{ outcome.title }}</strong>
                      <p>{{ outcome.summary }}</p>
                      <span class="tag-chip">{{ outcome.visibility === 'gm-only' ? 'GM only' : 'Player safe' }}</span>
                    </button>
                  } @empty {
                    <article class="scene-outcome-card scene-outcome-card-empty">
                      <strong>No explicit outcomes</strong>
                      <p>This node currently relies on status, notes, and downstream scene choice.</p>
                    </article>
                  }
                </div>
              </section>
            </div>
          </section>

          <aside class="scene-context-rail">
            <section class="card engraved-panel scene-utility-panel">
              <div class="card-header">
                <div class="section-heading">
                  <h3>Runtime controls</h3>
                </div>
              </div>

              <div class="scene-utility-stack">
                <div class="button-row wrap-row">
                  @for (status of sceneStatusOptions; track status) {
                    <button
                      type="button"
                      class="button-outline micro-action"
                      [class.status-action-active]="activeScene.state.status === status"
                      (click)="setSceneStatus(status)"
                    >
                      {{ sceneStatusLabel(status) }}
                    </button>
                  }
                </div>

                <label class="compact-field">
                  <span>Quick note</span>
                  <textarea [formControl]="quickNoteControl" rows="3" placeholder="Capture the live table beat..."></textarea>
                </label>

                <div class="button-row">
                  <button type="button" (click)="submitQuickNote()">Add note</button>
                </div>

                @if (activeScene.state.localNotes.length) {
                  <div class="scene-runtime-notes">
                    @for (note of activeScene.state.localNotes; track note) {
                      <article class="mini-panel">
                        <p>{{ note }}</p>
                      </article>
                    }
                  </div>
                }
              </div>
            </section>

            <section class="card engraved-panel scene-stage-panel">
              <div class="card-header">
                <div class="section-heading">
                  <h3>Stage utility</h3>
                  <p>{{ activeSessionLabel() }}</p>
                </div>
              </div>

              @if (!activeSessionId()) {
                <article class="empty-card">Pick an active session in the shell header before using stage actions from Scene View.</article>
              } @else {
                <div class="scene-stage-stack">
                  <label class="compact-field">
                    <span>Linked stage scene</span>
                    <select [formControl]="stageSceneControl">
                      <option value="">No linked stage scene</option>
                      @for (stageScene of store.stageScenes(); track stageScene.id) {
                        <option [value]="stageScene.id">{{ stageScene.order }} · {{ stageScene.title }}</option>
                      }
                    </select>
                  </label>

                  @if (linkedStageScene(); as stageScene) {
                    <article class="stage-preview-card">
                      <div class="stage-preview-visual" [style.background-image]="stagePreviewImage(stageScene)"></div>
                      <div class="stage-preview-copy">
                        <div class="stage-preview-head">
                          <strong>{{ stageScene.title }}</strong>
                          <span class="tag-chip">{{ liveStageLabel(stageScene) }}</span>
                        </div>
                        @if (stageScene.gmNotes) {
                          <p>{{ stageScene.gmNotes }}</p>
                        } @else {
                          <p>Linked for preview and publish.</p>
                        }
                      </div>
                    </article>

                    <div class="button-row wrap-row">
                      <button type="button" (click)="publishStageScene()">Publish to stage</button>
                    </div>

                    @if (youtubeThumbnail(linkedStageScene()); as thumbnailUrl) {
                      <button type="button" class="youtube-preview-card" (click)="openYoutube(linkedStageScene()?.youtubeUrl)">
                        <div class="youtube-preview-image" [style.background-image]="'url(' + thumbnailUrl + ')'"></div>
                        <div class="youtube-preview-copy">
                          <strong>YouTube reference</strong>
                          <p>{{ linkedStageScene()?.youtubeUrl }}</p>
                        </div>
                      </button>
                    }
                  } @else {
                    <article class="empty-card">Link a session stage scene to preview it here, publish it directly, and keep the media reference close to the scene.</article>
                  }
                </div>
              }
            </section>

            <section class="card engraved-panel scene-context-panel">
              <div class="card-header">
                <div class="section-heading">
                  <h3>Context</h3>
                  <p>{{ linkedNpcCards().length + linkedGoals().length + linkedLocations().length }} linked items</p>
                </div>
              </div>

              <div class="scene-context-stack">
                <article class="mini-panel">
                  <p class="eyebrow">NPCs</p>
                  <div class="list-stack compact-stack">
                    @for (card of linkedNpcCards(); track card.npc.id) {
                      <article class="context-row">
                        <strong>{{ npcLabel(card) }}</strong>
                        <p>{{ card.summary }}</p>
                        @if (card.appearance?.stance) {
                          <span class="tag-chip">{{ card.appearance?.stance }}</span>
                        }
                      </article>
                    } @empty {
                      <p class="empty-inline">No linked NPCs.</p>
                    }
                  </div>
                </article>

                <article class="mini-panel">
                  <p class="eyebrow">PC goals</p>
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

                <article class="mini-panel">
                  <p class="eyebrow">Connected scenes</p>
                  <div class="list-stack compact-stack">
                    @for (entry of connectedScenes(); track entry.edgeId) {
                      <a class="connected-node-row" [routerLink]="sceneRoute(entry.scene.id)">
                        <div>
                          <strong>{{ entry.scene.title }}</strong>
                          <p>{{ entry.direction === 'outgoing' ? 'Next' : 'From' }} · {{ sceneKindLabel(entry.scene) }}</p>
                        </div>
                        <div class="connected-node-meta">
                          <span class="tag-chip">{{ entry.label }}</span>
                          <span class="tag-chip">{{ sceneStatusLabel(entry.scene.state.status) }}</span>
                        </div>
                      </a>
                    } @empty {
                      <p class="empty-inline">No connected scenes.</p>
                    }
                  </div>
                </article>
              </div>
            </section>
          </aside>
        </div>
      } @else {
        <section class="card engraved-panel empty-card">This scene could not be resolved from the current chapter flow.</section>
      }
    } @else {
      <section class="card engraved-panel empty-card">Loading the focused scene view…</section>
    }
  `,
  styleUrl: './campaign-scene-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignScenePageComponent {
  readonly store = inject(CampaignConsoleStore);
  readonly sessionStore = inject(SessionStoreService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly quickNoteControl = new FormControl(EMPTY_VALUE, { nonNullable: true });
  readonly stageSceneControl = new FormControl(EMPTY_VALUE, { nonNullable: true });
  readonly sceneStatusOptions = SCENE_STATUS_MUTATION_ORDER;

  private readonly campaignId = toSignal(
    this.route.paramMap.pipe(
      map((params) => params.get('campaignId') ?? EMPTY_VALUE),
      startWith(this.route.snapshot.paramMap.get('campaignId') ?? EMPTY_VALUE),
    ),
    { initialValue: this.route.snapshot.paramMap.get('campaignId') ?? EMPTY_VALUE },
  );

  private readonly sceneId = toSignal(
    this.route.paramMap.pipe(
      map((params) => params.get('sceneId') ?? EMPTY_VALUE),
      startWith(this.route.snapshot.paramMap.get('sceneId') ?? EMPTY_VALUE),
    ),
    { initialValue: this.route.snapshot.paramMap.get('sceneId') ?? EMPTY_VALUE },
  );

  readonly scene = computed(() => {
    const data = this.store.consoleData();
    return data ? data.sceneIndex[this.sceneId()] ?? null : null;
  });

  readonly activeSessionId = computed(() => this.sessionStore.activeSessionId());

  readonly linkedNpcCards = computed(() => {
    const scene = this.scene();
    const data = this.store.consoleData();
    if (!scene || !data) {
      return [] as LinkedNpcEntry[];
    }

    return buildLinkedNpcEntries(scene, data.npcs, data.npcAppearances);
  });

  readonly linkedGoals = computed(() => {
    const scene = this.scene();
    const data = this.store.consoleData();
    if (!scene || !data) {
      return [];
    }

    return data.pcGoals.filter((goal) => isGoalLinkedToScene(goal, scene));
  });

  readonly linkedLocations = computed(() => {
    const scene = this.scene();
    const data = this.store.consoleData();
    if (!scene || !data) {
      return [] as Location[];
    }

    return data.locations.filter((location) => scene.linkedLocationIds.includes(location.id));
  });

  readonly linkedOutcomes = computed(() => {
    const scene = this.scene();
    const data = this.store.consoleData();
    if (!scene || !data) {
      return [];
    }

    return data.outcomes.filter((outcome) => scene.outcomeIds.includes(outcome.id));
  });

  readonly connectedScenes = computed(() => {
    const scene = this.scene();
    const data = this.store.consoleData();
    if (!scene || !data) {
      return [];
    }

    return buildConnectedSceneEntries(scene, data.board.edges, data.sceneIndex);
  });

  readonly sceneApproaches = computed(() => {
    const scene = this.scene();
    const data = this.store.consoleData();
    if (!scene || !data) {
      return [] as Array<{ id: string; title: string; summary: string; kind: string }>;
    }

    const hookApproaches = data.hooks
      .filter((hook) => hook.sceneNodeId === scene.id)
      .map((hook) => ({
        id: hook.id,
        title: hook.title,
        summary: hook.prompt,
        kind: hook.mode === 'active' ? 'Approach' : 'Hook',
      }));

    const linkedEndeavor = scene.endeavorId ? data.endeavors.find((endeavor) => endeavor.id === scene.endeavorId) : undefined;
    const obstacleApproaches =
      linkedEndeavor
        ? data.obstacles
            .filter((obstacle) => linkedEndeavor.obstacleIds.includes(obstacle.id))
            .flatMap((obstacle) =>
              obstacle.approaches.map((approach) => ({
                id: approach.id,
                title: `${obstacle.title}: ${approach.label}`,
                summary: approach.description,
                kind: 'Endeavor',
              })),
            )
        : [];

    return [...hookApproaches, ...obstacleApproaches];
  });

  readonly linkedStageScene = computed(() => {
    const stageSceneId = this.scene()?.state.linkedStageSceneId;
    if (!stageSceneId) {
      return null;
    }

    return this.store.stageScenes().find((scene) => scene.id === stageSceneId) ?? null;
  });

  constructor() {
    effect(() => {
      const campaignId = this.campaignId();
      if (campaignId) {
        void this.store.loadConsole(campaignId);
      }
    });

    effect(() => {
      const activeSessionId = this.activeSessionId();
      if (activeSessionId) {
        void this.store.loadStageBridge(activeSessionId);
      } else {
        this.store.clearStageBridge();
      }
    });

    effect(() => {
      const linkedStageSceneId = this.scene()?.state.linkedStageSceneId ?? EMPTY_VALUE;
      if (this.stageSceneControl.value !== linkedStageSceneId) {
        this.stageSceneControl.setValue(linkedStageSceneId, { emitEvent: false });
      }
    });

    const stageSceneSub = this.stageSceneControl.valueChanges.subscribe((stageSceneId) => {
      const campaignId = this.campaignId();
      const scene = this.scene();
      if (!campaignId || !scene) {
        return;
      }

      const normalizedStageSceneId = stageSceneId || null;
      const currentStageSceneId = scene.state.linkedStageSceneId ?? null;
      if (normalizedStageSceneId === currentStageSceneId) {
        return;
      }

      void this.store.linkSceneStage(campaignId, {
        sceneNodeId: scene.id,
        stageSceneId: normalizedStageSceneId,
      });
    });

    this.destroyRef.onDestroy(() => stageSceneSub.unsubscribe());
  }

  flowRoute(): string[] {
    return ['/gm/campaigns', this.campaignId()];
  }

  sceneRoute(sceneId: string): string[] {
    return ['/gm/campaigns', this.campaignId(), 'scenes', sceneId];
  }

  sceneGridColumn(node: ResolvedSceneNode): string {
    return buildSceneGridColumn(node);
  }

  sceneGridRow(node: ResolvedSceneNode): string {
    return buildSceneGridRow(node);
  }

  sceneKindLabel(scene: ResolvedSceneNode): string {
    return SCENE_KIND_LABELS[scene.sceneKind];
  }

  classificationLabel(scene: ResolvedSceneNode): string {
    return FLOW_NODE_CLASSIFICATION_LABELS[scene.resolvedPlanning.classification];
  }

  readinessLabel(scene: ResolvedSceneNode): string {
    return FLOW_NODE_READINESS_LABELS[scene.resolvedPlanning.readiness];
  }

  sceneStatusLabel(status: ResolvedSceneNode['state']['status']): string {
    return SCENE_STATUS_LABELS[status];
  }

  npcLabel(card: LinkedNpcEntry): string {
    return card.appearance?.aliasInScene || card.npc.canonicalName;
  }

  locationSummary(location: Location): string {
    const resolved = resolveLayered(location.content);
    return resolved.publicSummary[0]?.text ?? resolved.gmTruth[0]?.text ?? 'No location summary yet.';
  }

  activeSessionLabel(): string {
    const sessionId = this.activeSessionId();
    if (!sessionId) {
      return 'No session';
    }

    return this.sessionStore.sessions().find((session) => session.id === sessionId)?.title ?? 'Selected session';
  }

  isOutcomeSelected(outcomeId: string): boolean {
    return this.scene()?.state.chosenOutcomeIds.includes(outcomeId) ?? false;
  }

  async toggleOutcome(outcomeId: string): Promise<void> {
    const campaignId = this.campaignId();
    const scene = this.scene();
    if (!campaignId || !scene) {
      return;
    }

    await this.store.selectSceneOutcome(campaignId, {
      sceneNodeId: scene.id,
      outcomeId,
      selected: !scene.state.chosenOutcomeIds.includes(outcomeId),
    });
  }

  sceneFocusText(scene: ResolvedSceneNode): string {
    return buildSceneFocusText(scene);
  }

  async setSceneStatus(status: Extract<SceneNodeStatus, 'available' | 'active' | 'completed' | 'skipped'>): Promise<void> {
    const campaignId = this.campaignId();
    const scene = this.scene();
    if (!campaignId || !scene || scene.state.status === status) {
      return;
    }

    await this.store.updateSceneState(campaignId, {
      sceneNodeId: scene.id,
      status,
    });
  }

  async submitQuickNote(): Promise<void> {
    const campaignId = this.campaignId();
    const scene = this.scene();
    const text = this.quickNoteControl.value.trim();
    if (!campaignId || !scene || !text) {
      return;
    }

    await this.store.addQuickNote(campaignId, {
      text,
      sceneNodeId: scene.id,
    });
    this.quickNoteControl.setValue(EMPTY_VALUE);
  }

  stagePreviewImage(stageScene: StageScene): string {
    return stageScene.backgroundImagePath ? `url(${stageScene.backgroundImagePath})` : '';
  }

  liveStageLabel(stageScene: StageScene): string {
    return this.store.liveStageState()?.liveSceneId === stageScene.id ? 'Live' : 'Draft';
  }

  youtubeThumbnail(stageScene: StageScene | null): string | null {
    return youtubeThumbnailUrl(stageScene?.youtubeUrl);
  }

  openYoutube(url: string | undefined): void {
    if (!url) {
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async publishStageScene(): Promise<void> {
    const activeSessionId = this.activeSessionId();
    const stageScene = this.linkedStageScene();
    if (!activeSessionId || !stageScene) {
      return;
    }

    await this.store.publishStageScene(activeSessionId, stageScene.id);
  }
}
