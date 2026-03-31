import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  ActionDefinition,
  CampaignConsoleData,
  EndeavorRun,
  EntityPointer,
  EventLogEntry,
  ResolvedNPCCard,
  ResolvedSceneNode,
  RuntimeResourceTarget,
} from '@shared/domain';
import { RosharIconComponent } from '../../shared/roshar-icon.component';
import { CampaignConsoleStore } from './campaign-console.store';

type InspectorTab = 'gm' | 'source' | 'diff' | 'truth' | 'entities' | 'rules';

@Component({
  selector: 'app-campaign-console-page',
  imports: [CommonModule, FormsModule, RosharIconComponent],
  template: `
    @if (store.consoleData(); as data) {
      <section class="page-header campaign-console-header card engraved-panel">
        <div class="route-heading">
          <p class="eyebrow">War Room</p>
          <h2>{{ data.campaign.title }} command board</h2>
          <p>React on the board, read the GM layer in the inspector, and keep runtime changes in the rail without leaving the chapter graph.</p>
        </div>
        <div class="campaign-header-stats">
          <article class="route-stat sapphire">
            <app-roshar-icon key="stage" label="Scenes" tone="sapphire" [size]="18" />
            <span class="stat-label">Scenes</span>
            <strong>{{ data.board.nodes.length }}</strong>
          </article>
          <article class="route-stat topaz">
            <app-roshar-icon key="chronicle" label="Active scene" tone="topaz" [size]="18" />
            <span class="stat-label">Active</span>
            <strong>{{ activeSceneTitle() }}</strong>
          </article>
          <article class="route-stat emerald">
            <app-roshar-icon key="aid" label="Intel" tone="emerald" [size]="18" />
            <span class="stat-label">Intel</span>
            <strong>{{ data.board.chapterState.counters['warcampIntel'] }}</strong>
          </article>
          <article class="route-stat ruby">
            <app-roshar-icon key="condition" label="Escalation" tone="ruby" [size]="18" />
            <span class="stat-label">Escalation</span>
            <strong>{{ data.board.chapterState.escalation }}</strong>
          </article>
        </div>
      </section>

      <div class="campaign-console-shell">
        <section class="card campaign-board-panel engraved-panel">
          <div class="card-header">
            <div class="section-heading">
              <app-roshar-icon key="stage" label="Board" tone="sapphire" [size]="18" />
              <h3>Chapter board</h3>
            </div>
            <span class="pill">{{ filteredNodes().length }} visible</span>
          </div>

          <label class="compact-field board-search">
            <span>Search the chapter</span>
            <input
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              type="search"
              placeholder="scene, hook, npc, tag..."
            />
          </label>

          <div class="lane-strip">
            <span>Search</span>
            <span>Contact</span>
            <span>Infiltration</span>
            <span>Exit</span>
          </div>

          <div class="scene-map">
            @for (node of filteredNodes(); track node.id) {
              <article
                class="scene-node"
                [class.scene-node-active]="selectedSceneId() === node.id"
                [class.scene-node-completed]="node.state.status === 'completed'"
                [class.scene-node-locked]="node.state.status === 'locked'"
                [style.grid-column]="gridColumn(node)"
                [style.grid-row]="gridRow(node)"
              >
                <button type="button" class="scene-node-surface" (click)="selectScene(node.id)">
                  <div class="scene-node-head">
                    <span class="pill">{{ node.state.status }}</span>
                    @if (node.gmDiff.changedBlocks || node.gmDiff.insertedBlocks || node.gmDiff.hiddenBlocks) {
                      <span class="pill diff-pill">{{ node.gmDiff.changedBlocks + node.gmDiff.insertedBlocks + node.gmDiff.hiddenBlocks }} edits</span>
                    }
                  </div>

                  <h3>{{ node.title }}</h3>
                  <p>{{ node.resolvedContent.summaryBlocks[0]?.text }}</p>

                  <div class="scene-node-tags">
                    @for (tag of node.tags; track tag) {
                      <span class="tag-chip">{{ tag }}</span>
                    }
                  </div>
                </button>

                <div class="scene-node-actions">
                  <button type="button" class="button-outline micro-action" (click)="mutateScene($event, node.id, 'active')">Activate</button>
                  <button type="button" class="button-outline micro-action" (click)="mutateScene($event, node.id, 'completed')">Complete</button>
                  <button type="button" class="button-outline micro-action" (click)="mutateScene($event, node.id, 'skipped')">Skip</button>
                  @if (node.state.status === 'locked') {
                    <button type="button" class="button-outline micro-action" (click)="mutateScene($event, node.id, 'available')">Unlock</button>
                  }
                </div>
              </article>
            }
          </div>

          <div class="edge-ledger">
            @for (edge of data.board.edges; track edge.id) {
              <span class="tag-chip">{{ sceneTitle(edge.fromSceneId) }} → {{ sceneTitle(edge.toSceneId) }}</span>
            }
          </div>
        </section>

        <section class="card campaign-inspector engraved-panel">
          @if (selectedScene(); as scene) {
            <div class="card-header inspector-header">
              <div class="section-heading">
                <app-roshar-icon key="chronicle" label="Inspector" tone="gold" [size]="18" />
                <div>
                  <h3>{{ scene.title }}</h3>
                  <p>{{ scene.sceneKind }} scene</p>
                </div>
              </div>
              <div class="button-row">
                @for (tab of inspectorTabs; track tab.id) {
                  <button
                    type="button"
                    class="button-outline inspector-tab"
                    [class.inspector-tab-active]="selectedTab() === tab.id"
                    (click)="selectedTab.set(tab.id)"
                  >
                    {{ tab.label }}
                  </button>
                }
              </div>
            </div>

            @switch (selectedTab()) {
              @case ('gm') {
                <div class="inspector-scroll">
                  <section class="inspector-copy">
                    <p class="eyebrow">Summary</p>
                    @for (block of scene.resolvedContent.summaryBlocks; track block.id) {
                      <p>{{ block.text }}</p>
                    }
                  </section>
                  <section class="inspector-copy">
                    <p class="eyebrow">GM adaptation</p>
                    @for (block of scene.resolvedContent.gmBlocks; track block.id) {
                      <p>{{ block.text }}</p>
                    }
                  </section>
                  @if (scene.state.localNotes.length) {
                    <section class="inspector-copy inset-panel">
                      <p class="eyebrow">Runtime notes</p>
                      @for (note of scene.state.localNotes; track note) {
                        <p>{{ note }}</p>
                      }
                    </section>
                  }
                </div>
              }
              @case ('source') {
                <div class="inspector-scroll split-column">
                  <section class="inset-panel">
                    <p class="eyebrow">Imported summary</p>
                    @for (block of sourceSummaryBlocks(scene); track block.id) {
                      <p>{{ block.text }}</p>
                    }
                  </section>
                  <section class="inset-panel">
                    <p class="eyebrow">Imported GM text</p>
                    @for (block of sourceGmBlocks(scene); track block.id) {
                      <p>{{ block.text }}</p>
                    }
                  </section>
                </div>
              }
              @case ('diff') {
                <div class="inspector-scroll split-column">
                  <section class="inset-panel">
                    <p class="eyebrow">Diff summary</p>
                    <div class="diff-summary">
                      <span class="tag-chip">{{ scene.gmDiff.changedBlocks }} changed</span>
                      <span class="tag-chip">{{ scene.gmDiff.insertedBlocks }} inserted</span>
                      <span class="tag-chip">{{ scene.gmDiff.hiddenBlocks }} hidden</span>
                    </div>
                    <p class="diff-caption">Prep and play read the resolved GM layer. Source stays preserved and visible.</p>
                  </section>
                  <section class="diff-grid">
                    <div class="inset-panel">
                      <p class="eyebrow">Source</p>
                      @for (block of sourceGmBlocks(scene); track block.id) {
                        <p>{{ block.text }}</p>
                      }
                    </div>
                    <div class="inset-panel">
                      <p class="eyebrow">Resolved</p>
                      @for (block of scene.resolvedContent.gmBlocks; track block.id) {
                        <p>{{ block.text }}</p>
                      }
                    </div>
                  </section>
                </div>
              }
              @case ('truth') {
                <div class="inspector-scroll">
                  <section class="inspector-copy truth-copy">
                    @for (block of scene.resolvedContent.hiddenTruthBlocks; track block.id) {
                      <p>{{ block.text }}</p>
                    }
                  </section>
                </div>
              }
              @case ('entities') {
                <div class="inspector-scroll split-column">
                  <section class="inset-panel">
                    <p class="eyebrow">Linked NPCs</p>
                    <div class="list-stack compact-stack">
                      @for (card of linkedNpcCards(); track card.npc.id) {
                        <article class="entity-card">
                          <h4>{{ card.appearance?.aliasInScene || card.npc.canonicalName }}</h4>
                          <p>{{ card.resolvedSummaryBlocks[0]?.text }}</p>
                          @if (card.appearance?.localGoal) {
                            <span class="tag-chip">Goal: {{ card.appearance?.localGoal }}</span>
                          }
                        </article>
                      } @empty {
                        <article class="empty-card">No linked NPC appearances on this node.</article>
                      }
                    </div>
                  </section>
                  <section class="inset-panel">
                    <p class="eyebrow">Linked locations</p>
                    <div class="list-stack compact-stack">
                      @for (location of linkedLocations(); track location.id) {
                        <article class="entity-card">
                          <h4>{{ location.name }}</h4>
                          <p>{{ locationSummary(location) }}</p>
                        </article>
                      } @empty {
                        <article class="empty-card">No linked locations on this node.</article>
                      }
                    </div>
                  </section>
                </div>
              }
              @case ('rules') {
                <div class="inspector-scroll split-column">
                  <section class="inset-panel">
                    <p class="eyebrow">Hooks</p>
                    <div class="list-stack compact-stack">
                      @for (hook of linkedHooks(); track hook.id) {
                        <article class="entity-card">
                          <h4>{{ hook.title }}</h4>
                          <p>{{ hook.prompt }}</p>
                        </article>
                      } @empty {
                        <article class="empty-card">No explicit hooks on this scene.</article>
                      }
                    </div>
                  </section>
                  <section class="inset-panel">
                    <p class="eyebrow">Rules and outcomes</p>
                    <div class="list-stack compact-stack">
                      @for (rule of linkedRules(); track rule.id) {
                        <article class="entity-card">
                          <h4>{{ rule.title }}</h4>
                          <p>{{ rule.excerptBlocks[0]?.text }}</p>
                        </article>
                      }
                      @for (outcome of linkedOutcomes(); track outcome.id) {
                        <article class="entity-card">
                          <h4>{{ outcome.title }}</h4>
                          <p>{{ outcome.summary }}</p>
                        </article>
                      }
                      @if (linkedEndeavor(); as endeavor) {
                        <article class="entity-card emphasis-card">
                          <h4>{{ endeavor.title }}</h4>
                          <p>{{ endeavor.objective }}</p>
                          <div class="scene-node-tags">
                            <span class="tag-chip">{{ endeavor.tracks.length }} tracks</span>
                            <span class="tag-chip">{{ linkedObstacles().length }} obstacles</span>
                          </div>
                        </article>
                      }
                      @if (linkedEncounter(); as encounter) {
                        <article class="entity-card emphasis-card">
                          <h4>{{ encounter.title }}</h4>
                          <p>{{ encounter.objective || 'Fallback combat convergence.' }}</p>
                        </article>
                      }
                      @if (scene.endeavorId && activeEndeavorRun(); as run) {
                        <article class="entity-card emphasis-card">
                          <div class="entity-card-head">
                            <h4>Active endeavor run</h4>
                            <span class="pill">{{ run.status }}</span>
                          </div>
                          <div class="scene-node-tags">
                            @for (entry of endeavorTrackEntries(run); track entry.key) {
                              <span class="tag-chip">{{ entry.key }} {{ entry.value }}</span>
                            }
                          </div>
                          <div class="list-stack compact-stack">
                            @for (state of availableObstacleStates(); track state.obstacleId) {
                              @if (obstacleForState(state); as obstacle) {
                                <article class="entity-card">
                                  <h4>{{ obstacle.title }}</h4>
                                  <p>{{ obstacle.summary }}</p>
                                  <div class="button-row wrap-row">
                                    @for (approach of obstacle.approaches; track approach.id) {
                                      <button type="button" class="button-outline micro-action" (click)="resolveApproach(obstacle.id, approach.id, 'success')">
                                        {{ approach.label }} ✓
                                      </button>
                                      <button type="button" class="button-outline micro-action" (click)="resolveApproach(obstacle.id, approach.id, 'mixed')">
                                        Mixed
                                      </button>
                                      <button type="button" class="button-outline micro-action" (click)="resolveApproach(obstacle.id, approach.id, 'failure')">
                                        Fail
                                      </button>
                                    }
                                  </div>
                                </article>
                              }
                            }
                          </div>
                        </article>
                      } @else if (linkedEndeavor()) {
                        <article class="entity-card emphasis-card">
                          <h4>Run the endeavor</h4>
                          <p>Start the live run to track progress, alert, and obstacle resolution inline.</p>
                          <div class="button-row">
                            <button type="button" (click)="startEndeavor()">Start endeavor</button>
                            <button type="button" class="button-outline" (click)="runEndeavorSimulation()">Simulate</button>
                          </div>
                        </article>
                      }
                    </div>
                  </section>
                </div>
              }
            }
          }
        </section>

        <aside class="card campaign-runtime engraved-panel">
          <div class="card-header">
            <div class="section-heading">
              <app-roshar-icon key="aid" label="Runtime" tone="emerald" [size]="18" />
              <h3>Runtime rail</h3>
            </div>
            <span class="pill">{{ data.runtime.recentEvents.length }} recent events</span>
          </div>

          <div class="runtime-stack">
            <section class="inset-panel">
              <p class="eyebrow">Quick capture</p>
              <textarea
                rows="4"
                [ngModel]="quickNote()"
                (ngModelChange)="quickNote.set($event)"
                placeholder="Capture the live table beat without leaving the board..."
              ></textarea>
              <div class="button-row">
                <button type="button" (click)="submitQuickNote()">Log note</button>
              </div>
            </section>

            <section class="inset-panel">
              <p class="eyebrow">Resource targets</p>
              <div class="runtime-targets">
                @for (target of data.runtime.resourceTargets; track target.entity.kind + ':' + target.entity.id) {
                  <button
                    type="button"
                    class="runtime-target-button"
                    [class.runtime-target-active]="selectedTargetKey() === target.entity.kind + ':' + target.entity.id"
                    (click)="selectedTargetKey.set(target.entity.kind + ':' + target.entity.id)"
                  >
                    <strong>{{ target.label }}</strong>
                    <span>{{ resourceSummary(target) }}</span>
                  </button>
                }
              </div>

              @if (selectedTarget(); as target) {
                <div class="resource-ledger">
                  @for (entry of resourceEntries(target); track entry.key) {
                    <article class="resource-card">
                      <div>
                        <span class="stat-label">{{ entry.key }}</span>
                        <strong>{{ entry.value }}</strong>
                      </div>
                      <div class="button-row">
                        @for (amount of resourceButtons(entry.key); track amount) {
                          <button type="button" class="button-outline micro-action" (click)="adjustResource(target.entity, entry.key, amount)">
                            {{ amount > 0 ? '+' + amount : amount }}
                          </button>
                        }
                      </div>
                    </article>
                  }

                  @if (target.conditions.length) {
                    <div class="condition-strip">
                      @for (condition of target.conditions; track condition.conditionId) {
                        <button type="button" class="button-outline micro-action" (click)="removeCondition(target.entity, condition.conditionId)">
                          {{ conditionName(condition.conditionId) }} ×
                        </button>
                      }
                    </div>
                  }
                </div>
              }
            </section>

            <section class="inset-panel">
              <p class="eyebrow">Favors</p>
              <div class="list-stack compact-stack">
                @for (usage of data.runtime.favorUsage; track usage.favor.id) {
                  <article class="entity-card">
                    <div class="entity-card-head">
                      <h4>{{ usage.favor.label }}</h4>
                      @if (usage.remainingUses !== undefined) {
                        <span class="pill">{{ usage.remainingUses }} left</span>
                      }
                    </div>
                    <p>{{ usage.favor.summary }}</p>
                    <div class="button-row">
                      <button type="button" class="button-outline micro-action" (click)="adjustFavor(usage.favor.id, 1)">Spend</button>
                      <button type="button" class="button-outline micro-action" (click)="adjustFavor(usage.favor.id, -1)">Restore</button>
                    </div>
                  </article>
                }
              </div>
            </section>

            <section class="inset-panel">
              <p class="eyebrow">Conditions</p>
              @if (selectedTarget(); as target) {
                <div class="condition-strip">
                  @for (condition of data.conditions; track condition.id) {
                    <button type="button" class="button-outline micro-action" (click)="applyCondition(target.entity, condition.id)">
                      {{ condition.name }}
                    </button>
                  }
                </div>
              } @else {
                <p class="empty-inline">Pick a resource target first.</p>
              }
            </section>

            <section class="inset-panel">
              <p class="eyebrow">Dice log</p>
              <div class="form-grid dice-grid">
                <label>
                  <span>Formula</span>
                  <input [ngModel]="diceFormula()" (ngModelChange)="diceFormula.set($event)" type="text" />
                </label>
                <label>
                  <span>Raw dice</span>
                  <input [ngModel]="rawDiceText()" (ngModelChange)="rawDiceText.set($event)" type="text" placeholder="16" />
                </label>
                <label>
                  <span>Modifier</span>
                  <input [ngModel]="diceModifier()" (ngModelChange)="setDiceModifier($event)" type="number" />
                </label>
                <label>
                  <span>Total</span>
                  <input [ngModel]="diceTotal()" (ngModelChange)="setDiceTotal($event)" type="number" />
                </label>
              </div>
              <div class="button-row">
                <button type="button" (click)="submitDiceRoll()">Log roll</button>
              </div>
            </section>

            <section class="inset-panel">
              <p class="eyebrow">Rules assist</p>
              <label class="compact-field">
                <span>Action</span>
                <select [ngModel]="selectedActionKey()" (ngModelChange)="selectedActionKey.set($event)">
                  <option value="">Choose action</option>
                  @for (action of data.actionDefinitions; track action.id) {
                    <option [value]="action.key">{{ action.label }}</option>
                  }
                </select>
              </label>
              <div class="button-row">
                <button type="button" (click)="evaluateSelectedAction()">Evaluate</button>
              </div>
              @if (store.lastRuleEvaluation(); as evaluation) {
                <div class="list-stack compact-stack">
                  @for (advisory of evaluation.advisories; track advisory.message) {
                    <article class="runtime-event">
                      <strong>{{ advisory.severity }}{{ advisory.blocking ? ' • block' : '' }}</strong>
                      <small>{{ advisory.message }}</small>
                    </article>
                  } @empty {
                    <article class="empty-card">No rule warnings for the selected action.</article>
                  }
                </div>
              }
            </section>

            <section class="inset-panel">
              <p class="eyebrow">Analytics</p>
              <div class="list-stack compact-stack">
                @for (bucket of data.analytics.diceByTag; track bucket.key) {
                  <article class="entity-card">
                    <h4>{{ bucket.key }}</h4>
                    <p>{{ bucket.count }} rolls • avg {{ bucket.average }}</p>
                  </article>
                } @empty {
                  <article class="empty-card">No analytics derived yet.</article>
                }
              </div>
              @if (latestSimulationResult(); as result) {
                <article class="entity-card emphasis-card">
                  <h4>Latest simulation</h4>
                  <p>Success rate {{ (result.successRate * 100).toFixed(0) }}% • {{ result.sampleSize }} runs</p>
                </article>
              }
            </section>

            <section class="inset-panel">
              <p class="eyebrow">Recent log</p>
              <div class="list-stack compact-stack">
                @for (event of data.runtime.recentEvents; track event.id) {
                  <article class="runtime-event">
                    <strong>{{ eventSummary(event) }}</strong>
                    <small>{{ event.occurredAt | date: 'shortTime' }}</small>
                  </article>
                }
              </div>
            </section>
          </div>
        </aside>
      </div>
    } @else {
      <section class="card engraved-panel empty-card">Loading the campaign command desk…</section>
    }
  `,
  styleUrl: './campaign-console-page.component.scss',
})
export class CampaignConsolePageComponent {
  readonly store = inject(CampaignConsoleStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly campaignId = signal('');
  readonly selectedSceneId = signal('');
  readonly selectedTab = signal<InspectorTab>('gm');
  readonly selectedTargetKey = signal('');
  readonly searchQuery = signal('');
  readonly quickNote = signal('');
  readonly diceFormula = signal('1d20+0');
  readonly rawDiceText = signal('16');
  readonly diceModifier = signal(0);
  readonly diceTotal = signal(16);
  readonly selectedActionKey = signal('');
  readonly simulationIterations = signal(250);
  readonly simulationSeed = signal(1337);

  readonly inspectorTabs = [
    { id: 'gm' as const, label: 'GM layer' },
    { id: 'source' as const, label: 'Source' },
    { id: 'diff' as const, label: 'Diff' },
    { id: 'truth' as const, label: 'Truth' },
    { id: 'entities' as const, label: 'Entities' },
    { id: 'rules' as const, label: 'Rules' },
  ];

  readonly filteredNodes = computed(() => {
    const data = this.store.consoleData();
    if (!data) {
      return [];
    }
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) {
      return data.board.nodes;
    }
    return data.board.nodes.filter((node) => {
      const haystack = [
        node.title,
        ...node.tags,
        ...node.resolvedContent.summaryBlocks.map((block) => block.text),
        ...node.resolvedContent.gmBlocks.map((block) => block.text),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  });

  readonly selectedScene = computed(() => this.store.consoleData()?.sceneIndex[this.selectedSceneId()] ?? null);
  readonly selectedTarget = computed(() =>
    this.store.consoleData()?.runtime.resourceTargets.find((target) => `${target.entity.kind}:${target.entity.id}` === this.selectedTargetKey()) ?? null,
  );
  readonly linkedNpcCards = computed(() => {
    const scene = this.selectedScene();
    const data = this.store.consoleData();
    if (!scene || !data) {
      return [] as ResolvedNPCCard[];
    }
    return data.npcCards.filter((card) => scene.linkedNpcAppearanceIds.includes(card.appearance?.id ?? ''));
  });
  readonly linkedLocations = computed(() => {
    const scene = this.selectedScene();
    const data = this.store.consoleData();
    if (!scene || !data) {
      return [];
    }
    return data.locations.filter((location) => scene.linkedLocationIds.includes(location.id));
  });
  readonly linkedRules = computed(() => {
    const scene = this.selectedScene();
    const data = this.store.consoleData();
    if (!scene || !data) {
      return [];
    }
    return data.rules.filter((rule) => scene.linkedRuleReferenceIds.includes(rule.id));
  });
  readonly linkedHooks = computed(() => {
    const scene = this.selectedScene();
    const data = this.store.consoleData();
    if (!scene || !data) {
      return [];
    }
    return data.hooks.filter((hook) => hook.sceneNodeId === scene.id);
  });
  readonly linkedOutcomes = computed(() => {
    const scene = this.selectedScene();
    const data = this.store.consoleData();
    if (!scene || !data) {
      return [];
    }
    return data.outcomes.filter((outcome) => scene.outcomeIds.includes(outcome.id));
  });
  readonly linkedEndeavor = computed(() => {
    const scene = this.selectedScene();
    const data = this.store.consoleData();
    return scene?.endeavorId ? data?.endeavors.find((endeavor) => endeavor.id === scene.endeavorId) ?? null : null;
  });
  readonly linkedObstacles = computed(() => {
    const endeavor = this.linkedEndeavor();
    const data = this.store.consoleData();
    return endeavor ? data?.obstacles.filter((obstacle) => endeavor.obstacleIds.includes(obstacle.id)) ?? [] : [];
  });
  readonly linkedEncounter = computed(() => {
    const scene = this.selectedScene();
    const data = this.store.consoleData();
    return scene?.encounterSetupId ? data?.encounters.find((encounter) => encounter.id === scene.encounterSetupId) ?? null : null;
  });
  readonly activeEndeavorRun = computed(() => {
    const scene = this.selectedScene();
    const data = this.store.consoleData();
    if (!scene?.endeavorId || !data?.activeEndeavorRun) {
      return null;
    }
    return data.activeEndeavorRun.endeavorId === scene.endeavorId ? data.activeEndeavorRun : null;
  });
  readonly availableObstacleStates = computed(() =>
    this.activeEndeavorRun()?.obstacleStates.filter((state) => state.status === 'available') ?? [],
  );
  readonly latestSimulationResult = computed(() => this.store.simulationResults()[0] ?? this.store.consoleData()?.simulationResults[0] ?? null);

  constructor() {
    const sub = this.route.paramMap.subscribe((params) => {
      const campaignId = params.get('campaignId');
      if (!campaignId) {
        return;
      }
      this.campaignId.set(campaignId);
      void this.store.loadCampaigns();
      void this.store.loadConsole(campaignId).then((data) => this.syncSelection(data));
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  selectScene(sceneId: string): void {
    this.selectedSceneId.set(sceneId);
  }

  async mutateScene(event: Event, sceneId: string, status: 'available' | 'active' | 'completed' | 'skipped'): Promise<void> {
    event.stopPropagation();
    const data = await this.store.updateSceneState(this.campaignId(), { sceneNodeId: sceneId, status });
    this.syncSelection(data, sceneId);
  }

  async submitQuickNote(): Promise<void> {
    const text = this.quickNote().trim();
    if (!text) {
      return;
    }
    const data = await this.store.addQuickNote(this.campaignId(), { text, sceneNodeId: this.selectedSceneId() || undefined });
    this.quickNote.set('');
    this.syncSelection(data);
  }

  async adjustResource(entity: EntityPointer, resourceKey: string, delta: number): Promise<void> {
    const data = await this.store.adjustResource(this.campaignId(), { entity, resourceKey, delta });
    this.syncSelection(data);
  }

  async adjustFavor(favorId: string, delta: number): Promise<void> {
    const data = await this.store.adjustFavor(this.campaignId(), { favorId, delta });
    this.syncSelection(data);
  }

  async applyCondition(entity: EntityPointer, conditionId: string): Promise<void> {
    const data = await this.store.mutateCondition(this.campaignId(), { entity, conditionId, operation: 'add' });
    this.syncSelection(data);
  }

  async removeCondition(entity: EntityPointer, conditionId: string): Promise<void> {
    const data = await this.store.mutateCondition(this.campaignId(), { entity, conditionId, operation: 'remove' });
    this.syncSelection(data);
  }

  async submitDiceRoll(): Promise<void> {
    const rawDice = this.rawDiceText()
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value));
    if (!rawDice.length) {
      return;
    }
    const data = await this.store.logDiceRoll(this.campaignId(), {
      sceneNodeId: this.selectedSceneId() || undefined,
      actor: this.selectedTarget()?.entity,
      formula: this.diceFormula(),
      rawDice,
      modifier: this.diceModifier(),
      total: this.diceTotal(),
      outcome: this.diceTotal() >= 15 ? 'success' : 'mixed',
      tags: ['runtime'],
    });
    this.syncSelection(data);
  }

  async evaluateSelectedAction(): Promise<void> {
    const action = this.currentAction();
    if (!action) {
      return;
    }
    await this.store.evaluateRules({
      campaignId: this.campaignId(),
      sceneNodeId: this.selectedSceneId() || undefined,
      phase: action.phase,
      trigger: action.phase === 'endeavor' ? 'action.attempt' : action.phase === 'conversation' ? 'conversation.exchange' : 'action.attempt',
      actionKey: action.key,
      actor: this.selectedTarget()?.entity,
      resolutionTags: action.resolutionTags,
    });
  }

  async startEndeavor(): Promise<void> {
    const endeavor = this.linkedEndeavor();
    if (!endeavor) {
      return;
    }
    const data = await this.store.startEndeavorRun(this.campaignId(), endeavor.id);
    this.syncSelection(data);
  }

  async resolveApproach(
    obstacleId: string,
    approachId: string,
    resolution: 'success' | 'mixed' | 'failure',
  ): Promise<void> {
    const run = this.activeEndeavorRun();
    if (!run) {
      return;
    }
    const data = await this.store.resolveEndeavorApproach(this.campaignId(), run.id, {
      obstacleId,
      approachId,
      resolution,
      actor: this.selectedTarget()?.entity,
    });
    this.syncSelection(data);
  }

  async runEndeavorSimulation(): Promise<void> {
    const endeavor = this.linkedEndeavor();
    if (!endeavor) {
      return;
    }
    const definition = await this.store.createSimulation({
      campaignId: this.campaignId(),
      label: `${endeavor.title} forecast`,
      kind: 'endeavor',
      endeavorId: endeavor.id,
      iterationCount: this.simulationIterations(),
      seed: this.simulationSeed(),
      variableMatrix: {
        successRate: [0.58],
        mixedRate: [0.22],
      },
      assumptions: ['Heuristic endeavor simulation', 'Uses first approach per obstacle'],
    });
    await this.store.runSimulation(this.campaignId(), definition.id);
  }

  sceneTitle(sceneId: string): string {
    return this.store.consoleData()?.sceneIndex[sceneId]?.title ?? sceneId;
  }

  currentAction(): ActionDefinition | null {
    const data = this.store.consoleData();
    return data?.actionDefinitions.find((action) => action.key === this.selectedActionKey()) ?? null;
  }

  activeSceneTitle(): string {
    const data = this.store.consoleData();
    return data?.sceneIndex[data.board.activeSceneId ?? '']?.title ?? 'None';
  }

  sourceSummaryBlocks(scene: ResolvedSceneNode) {
    return scene.content.source ? scene.content.source.value.summaryBlocks : [];
  }

  sourceGmBlocks(scene: ResolvedSceneNode) {
    return scene.content.source ? scene.content.source.value.gmBlocks : [];
  }

  locationSummary(location: CampaignConsoleData['locations'][number]): string {
    return location.content.source?.value.publicSummary[0]?.text ?? 'No source summary';
  }

  endeavorTrackEntries(run: EndeavorRun): Array<{ key: string; value: number }> {
    return Object.entries(run.trackValues).map(([key, value]) => ({ key, value }));
  }

  obstacleForState(state: EndeavorRun['obstacleStates'][number]) {
    return this.linkedObstacles().find((obstacle) => obstacle.id === state.obstacleId) ?? null;
  }

  gridColumn(node: ResolvedSceneNode): string {
    return `${node.board.x + 1}`;
  }

  gridRow(node: ResolvedSceneNode): string {
    return `${node.board.y + 1}`;
  }

  resourceEntries(target: RuntimeResourceTarget): Array<{ key: string; value: number }> {
    return Object.entries(target.resources).map(([key, value]) => ({ key, value }));
  }

  resourceButtons(resourceKey: string): number[] {
    return resourceKey === 'health' ? [-5, -1, 1] : [-1, 1];
  }

  resourceSummary(target: RuntimeResourceTarget): string {
    return this.resourceEntries(target)
      .slice(0, 3)
      .map((entry) => `${entry.key} ${entry.value}`)
      .join(' • ');
  }

  conditionName(conditionId: string): string {
    return this.store.consoleData()?.conditions.find((condition) => condition.id === conditionId)?.name ?? conditionId;
  }

  eventSummary(event: EventLogEntry): string {
    switch (event.kind) {
      case 'scene.activated':
      case 'scene.completed':
      case 'scene.skipped':
      case 'scene.unlocked':
        return `${this.sceneTitle(event.sceneNodeId ?? '')}: ${event.kind.split('.')[1]}`;
      case 'resource.changed':
        return `${String(event.payload['entityId'] ?? 'entity')} ${Number(event.payload['delta'] ?? 0) > 0 ? 'gains' : 'spends'} ${Math.abs(Number(event.payload['delta'] ?? 0))} ${String(event.payload['resourceKey'] ?? 'resource')}`;
      case 'favor.spent':
      case 'favor.gained':
        return `${event.kind === 'favor.spent' ? 'Favor spent' : 'Favor restored'}: ${String(event.payload['favorId'] ?? '')}`;
      case 'condition.applied':
      case 'condition.removed':
        return `${this.conditionName(String(event.payload['conditionId'] ?? ''))} ${event.kind === 'condition.applied' ? 'applied' : 'removed'}`;
      case 'dice.rolled':
        return `Dice roll ${String(event.payload['formula'] ?? '')} = ${String(event.payload['total'] ?? '')}`;
      case 'note.captured':
        return 'Note captured';
      default:
        return event.kind;
    }
  }

  setDiceModifier(value: string | number): void {
    this.diceModifier.set(Number(value) || 0);
  }

  setDiceTotal(value: string | number): void {
    this.diceTotal.set(Number(value) || 0);
  }

  private syncSelection(data: CampaignConsoleData, preferredSceneId?: string): void {
    const nextSceneId =
      (preferredSceneId && data.sceneIndex[preferredSceneId] ? preferredSceneId : '') ||
      (this.selectedSceneId() && data.sceneIndex[this.selectedSceneId()] ? this.selectedSceneId() : '') ||
      data.board.activeSceneId ||
      data.board.nodes[0]?.id ||
      '';
    this.selectedSceneId.set(nextSceneId);

    const targetKey = this.selectedTargetKey();
    const targetStillExists = data.runtime.resourceTargets.some((target) => `${target.entity.kind}:${target.entity.id}` === targetKey);
    if (!targetStillExists) {
      const firstTarget = data.runtime.resourceTargets[0];
      this.selectedTargetKey.set(firstTarget ? `${firstTarget.entity.kind}:${firstTarget.entity.id}` : '');
    }
  }
}
