import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ACTION_CATALOG,
  ActionCatalogItem,
  ActionKind,
  CombatPhase,
  CombatParticipantState,
  CombatPresetAction,
  CombatRecord,
  CombatRound,
  CombatTurn,
  HitResult,
} from '@shared/domain';
import { RosharIconComponent } from '../../shared/roshar-icon.component';
import { actionIcon, resultIcon } from '../../shared/roshar-icons';
import { CombatParticipantRowComponent } from './combat-participant-row.component';
import { CombatResolutionBoardComponent } from './combat-resolution-board.component';
import { CombatStore } from './combat.store';
import {
  BattleLane,
  ChronicleEntry,
  CombatActionForm,
  CombatConditionForm,
  PhaseGroup,
  ResolutionActionChoice,
  ResolutionActionGroup,
  ResolutionMode,
  ResolutionModeOption,
  ResolutionSupportText,
  ResolutionTargetChip,
  ResultChip,
} from './combat-tracker.types';

const COMBAT_PHASES: CombatPhase[] = ['fast-pc', 'fast-npc', 'slow-pc', 'slow-npc'];
const PC_PHASES: CombatPhase[] = ['fast-pc', 'slow-pc'];
const QUICK_D20_VALUES = Array.from({ length: 20 }, (_, index) => index + 1);
const QUICK_COUNT_VALUES = [0, 1, 2, 3] as const;
const DEFAULT_EXPANDED_PHASES: CombatPhase[] = [];
const DEFAULT_STRIKE_ACTION_KEY = 'strike';
const DEFAULT_CUSTOM_ACTION_KEY = 'custom';
const DEFAULT_REACTION_ACTION_KEY = 'custom-reaction';
const ACTION_CHOICE_PREFIX = 'catalog:';
const PRESET_CHOICE_PREFIX = 'preset:';
const QUICK_DAMAGE_REASON = 'Quick battle-board damage';
const QUICK_HEALING_REASON = 'Quick battle-board healing';
const MANUAL_FOCUS_REASON = 'Manual focus adjustment';
const MANUAL_INVESTITURE_REASON = 'Manual investiture adjustment';
const PLAYER_SIDE = 'pc';
const CUSTOM_ACTION_KEYS = new Set([DEFAULT_CUSTOM_ACTION_KEY, DEFAULT_REACTION_ACTION_KEY]);
const WAITING_FOR_FAST_NPC_LABEL = 'Will act in Fast NPC';
const WAITING_FOR_SLOW_NPC_LABEL = 'Will act in Slow NPC';
const WAITING_FOR_SLOW_PC_LABEL = 'Will act in Slow PC';
const PHASE_PASSED_THIS_ROUND_LABEL = 'Phase already passed this round';
const CAN_COMMIT_NOW_LABEL = 'Can commit now';
const TURN_ALREADY_COMMITTED_LABEL = 'Turn already committed';

const RESULT_CHIPS: ResultChip[] = [
  { value: 'hit', label: 'Hit', tone: 'emerald' },
  { value: 'miss', label: 'Miss', tone: 'ruby' },
  { value: 'graze', label: 'Graze', tone: 'topaz' },
  { value: 'criticalHit', label: 'Critical Hit', tone: 'topaz' },
  { value: 'criticalMiss', label: 'Critical Miss', tone: 'ruby' },
  { value: 'support', label: 'Support', tone: 'sapphire' },
];

const RESOLUTION_MODES: ResolutionModeOption[] = [
  { key: 'action', label: 'Action', description: 'Use handbook actions, enemy presets, or the generic custom action.' },
  { key: 'reaction', label: 'Reaction', description: 'Use handbook reactions, preset reactions, or Custom Reaction.' },
];

const COMMON_CONDITIONS = ['Dazed', 'Prone', 'Marked', 'Inspired', 'Bleeding'];

function sortCatalogWithPriority(items: ActionCatalogItem[], priorityKey: string): ActionCatalogItem[] {
  return [...items].sort((left, right) => {
    if (left.key === priorityKey) {
      return -1;
    }
    if (right.key === priorityKey) {
      return 1;
    }
    return left.name.localeCompare(right.name);
  });
}

function buildCatalogChoice(item: ActionCatalogItem): ResolutionActionChoice {
  return {
    id: `${ACTION_CHOICE_PREFIX}${item.key}`,
    label: item.name,
    actionType: item.key,
    actionKind: item.type,
    requiresTarget: item.requiresTarget,
    requiresRoll: item.requiresRoll,
    supportsDamage: item.supportsDamage,
    defaultActionCost: item.defaultActionCost,
    defaultFocusCost: item.defaultFocusCost,
    tags: item.tags,
    warnOncePerCombat: item.warnOncePerCombat,
    repeatablePerTurn: item.repeatablePerTurn,
    variableActionCost: item.variableActionCost,
    helperText: item.helperText,
    source: 'catalog',
  };
}

function buildPresetChoice(action: CombatPresetAction): ResolutionActionChoice {
  const helperTextParts = [action.rangeText?.trim(), action.description?.trim()].filter(Boolean);
  return {
    id: `${PRESET_CHOICE_PREFIX}${action.id}`,
    label: action.name,
    actionType: action.name,
    actionKind: action.kind,
    presetActionId: action.id,
    requiresTarget: action.requiresTarget,
    requiresRoll: action.requiresRoll,
    supportsDamage: action.supportsDamage,
    defaultActionCost: action.actionCost,
    defaultFocusCost: action.focusCost,
    defaultModifier: action.defaultModifier,
    defaultDamageFormula: action.defaultDamageFormula,
    helperText: helperTextParts.length ? helperTextParts.join(' \u2022 ') : undefined,
    tags: [],
    source: 'preset',
  };
}

function isSupportTargetAction(action: ResolutionActionChoice | null): boolean {
  return Boolean(action?.tags.includes('support') && !action.tags.includes('attack'));
}

@Component({
  selector: 'app-combat-tracker-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    RosharIconComponent,
    CombatParticipantRowComponent,
    CombatResolutionBoardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.combat(); as combat) {
      <section class="page-header combat-command-bar card engraved-panel">
        <div class="combat-command-copy">
          <p class="eyebrow">Combat tracker</p>
          <h2>{{ combat.title }}</h2>
          <p>Keep phase commitment in the rail, keep the battlefield visible in the middle, and resolve strikes or custom actions from one wide board without hunting through a narrow form.</p>
        </div>
        <div class="combat-command-side">
          <div class="combat-command-stats">
            <article class="route-stat sapphire">
              <app-roshar-icon key="sessions" label="Participants" tone="sapphire" [size]="18" />
              <span class="stat-label">Participants</span>
              <strong>{{ combat.participants.length }}</strong>
            </article>
            <article class="route-stat topaz">
              <app-roshar-icon key="fast" label="Round" tone="topaz" [size]="18" />
              <span class="stat-label">Round</span>
              <strong>{{ currentRound()?.roundNumber || combat.currentRoundNumber || 0 }}</strong>
            </article>
            <article class="route-stat ruby">
              <app-roshar-icon key="chronicle" label="Entries" tone="ruby" [size]="18" />
              <span class="stat-label">Chronicle</span>
              <strong>{{ chronicleEntries().length }}</strong>
            </article>
          </div>
          <div class="button-row combat-command-actions">
            @if (combat.status === 'planned') {
              <button type="button" (click)="startCombat()">Start combat</button>
            } @else {
              <button type="button" [disabled]="!canAdvancePhase()" (click)="advancePhase()">
                {{ currentRound()?.currentPhase === 'slow-npc' ? 'Next round' : 'Advance phase' }}
              </button>
            }
            <button type="button" class="button-outline" (click)="chronicleOpen.set(!chronicleOpen())">
              {{ chronicleOpen() ? 'Hide chronicle' : 'Show chronicle' }}
            </button>
            <button type="button" class="button-outline" [disabled]="combat.status !== 'active'" (click)="finishCombat()">Finish combat</button>
            <a [routerLink]="['/sessions', combat.sessionId, 'combats', combat.id, 'summary']" class="button-outline">Summary</a>
          </div>
        </div>
      </section>

      <div class="combat-layout combat-live-grid">
        <aside class="card engraved-panel combat-sidebar tactical-rail" data-tour="combat-turn-groups">
          <div class="card-header">
            <div class="section-heading">
              <app-roshar-icon key="combat" label="Phase rail" tone="ruby" [size]="18" />
              <h3>Phase rail</h3>
            </div>
            @if (currentRound()) {
              <span class="pill">Round {{ currentRound()!.roundNumber }}</span>
            }
          </div>

          @if (combat.status === 'planned') {
            <article class="empty-card">Start combat to create round 1 and begin live Fast and Slow commitment.</article>
          } @else if (currentRound(); as round) {
            <section class="inset-panel phase-status-panel">
              <div>
                <p class="eyebrow">Current phase</p>
                <h3>{{ phaseLabel(round.currentPhase) }}</h3>
                <p class="muted">{{ advancePhaseGuidance() }}</p>
              </div>
              <div class="phase-status-side">
                <span class="tag-chip" [class.emphasis-pill]="canAdvancePhase()">{{ advanceStatusLabel() }}</span>
                <small class="muted">
                  Ready now {{ readyParticipants().length }} · Later {{ laterParticipants().length + passedParticipants().length }}
                </small>
                <button type="button" class="button-outline micro-button" [disabled]="!canAdvancePhase()" (click)="advancePhase()">
                  {{ round.currentPhase === 'slow-npc' ? 'Open next round' : 'Advance phase' }}
                </button>
              </div>
            </section>

            <section class="planner-block">
              <div class="card-header compact-card-header">
                <div class="section-heading">
                  <app-roshar-icon key="sessions" label="Ready now" tone="sapphire" [size]="16" />
                  <h3>Ready now</h3>
                </div>
                <span class="pill">{{ readyParticipants().length }}</span>
              </div>

              <div class="round-planner-list unresolved-list compact-unresolved-list">
                @for (entry of readyParticipants(); track entry.participant.id) {
                  <article class="round-planner-row unresolved-entry compact-unresolved-entry" [class.active]="selectedParticipantId() === entry.participant.id">
                    <button type="button" class="list-item-button unresolved-entry-button" (click)="selectParticipant(entry.participant.id)">
                      <div>
                        <strong class="event-line">
                          <app-roshar-icon key="sessions" [label]="entry.participant.name" [tone]="participantTone(entry.participant.side)" [size]="15" />
                          {{ entry.participant.name }}
                        </strong>
                        <small>{{ commitStatusLabel(entry.participant.id) }}</small>
                      </div>
                      <span class="tag-chip">
                        <app-roshar-icon key="reaction" label="Reaction" [tone]="entry.state.reactionAvailable ? 'emerald' : 'ruby'" [size]="12" />
                        {{ entry.state.reactionAvailable ? 'Ready' : 'Spent' }}
                      </span>
                    </button>
                    <button type="button" class="button-outline micro-button" (click)="commitParticipant(entry.participant.id)">
                      {{ commitLabel(round.currentPhase) }}
                    </button>
                  </article>
                } @empty {
                  <article class="empty-card">No one can commit in this phase right now.</article>
                }
              </div>
            </section>

            @if (laterParticipants().length || passedParticipants().length) {
              <section class="planner-block">
                <div class="card-header compact-card-header">
                  <div class="section-heading">
                    <app-roshar-icon key="slow" label="Later this round" tone="topaz" [size]="16" />
                    <h3>Later this round</h3>
                  </div>
                  <span class="pill">{{ laterParticipants().length + passedParticipants().length }}</span>
                </div>

                <div class="round-planner-list unresolved-list compact-unresolved-list">
                  @for (entry of laterParticipants(); track entry.participant.id) {
                    <article class="round-planner-row unresolved-entry compact-unresolved-entry" [class.active]="selectedParticipantId() === entry.participant.id">
                      <button type="button" class="list-item-button unresolved-entry-button" (click)="selectParticipant(entry.participant.id)">
                        <div>
                          <strong class="event-line">
                            <app-roshar-icon key="sessions" [label]="entry.participant.name" [tone]="participantTone(entry.participant.side)" [size]="15" />
                            {{ entry.participant.name }}
                          </strong>
                          <small>{{ commitStatusLabel(entry.participant.id) }}</small>
                        </div>
                        <span class="tag-chip">
                          <app-roshar-icon key="reaction" label="Reaction" [tone]="entry.state.reactionAvailable ? 'emerald' : 'ruby'" [size]="12" />
                          {{ entry.state.reactionAvailable ? 'Ready' : 'Spent' }}
                        </span>
                      </button>
                    </article>
                  }

                  @for (entry of passedParticipants(); track entry.participant.id) {
                    <article class="round-planner-row unresolved-entry compact-unresolved-entry" [class.active]="selectedParticipantId() === entry.participant.id">
                      <button type="button" class="list-item-button unresolved-entry-button" (click)="selectParticipant(entry.participant.id)">
                        <div>
                          <strong class="event-line">
                            <app-roshar-icon key="sessions" [label]="entry.participant.name" [tone]="participantTone(entry.participant.side)" [size]="15" />
                            {{ entry.participant.name }}
                          </strong>
                          <small>{{ commitStatusLabel(entry.participant.id) }}</small>
                        </div>
                        <span class="tag-chip">
                          <app-roshar-icon key="reaction" label="Reaction" [tone]="entry.state.reactionAvailable ? 'emerald' : 'ruby'" [size]="12" />
                          {{ entry.state.reactionAvailable ? 'Ready' : 'Spent' }}
                        </span>
                      </button>
                    </article>
                  }
                </div>
              </section>
            }

            @if (activePhaseGroup(); as activeGroup) {
              <section class="planner-block">
                <div class="card-header compact-card-header">
                  <div class="section-heading">
                    <app-roshar-icon [key]="phaseIcon(activeGroup.phase)" [label]="activeGroup.label" [tone]="phaseTone(activeGroup.phase)" [size]="15" />
                    <h3>{{ activeGroup.label }}</h3>
                  </div>
                  <span class="pill">{{ activeGroup.turns.length }}</span>
                </div>

                <div class="list-stack planner-turn-stack">
                  @for (turn of activeGroup.turns; track turn.id; let index = $index) {
                    <article class="planner-turn-card" [class.active]="selectedTurnId() === turn.id" [class.turn-complete]="turn.status === 'complete'">
                      <button type="button" class="list-item-button planner-turn-button" (click)="selectTurn(turn)">
                        <div>
                          <strong>{{ participantName(turn.participantId) }}</strong>
                          <small>{{ turn.turnType }} turn · {{ turn.status }}</small>
                        </div>
                        <span>{{ turn.actionsUsed }}/{{ turn.actionsAvailable }}</span>
                      </button>
                      <div class="mini-adjusters">
                        <button type="button" class="button-outline micro-button" [disabled]="index === 0" (click)="moveTurn(activeGroup.phase, turn.id, -1)">Up</button>
                        <button type="button" class="button-outline micro-button" [disabled]="index === activeGroup.turns.length - 1" (click)="moveTurn(activeGroup.phase, turn.id, 1)">Down</button>
                      </div>
                    </article>
                  } @empty {
                    <article class="empty-card">No turns committed in the active queue yet.</article>
                  }
                </div>
              </section>
            }

            <section class="planner-block">
              <div class="card-header compact-card-header">
                <div class="section-heading">
                  <app-roshar-icon key="slow" label="Other queues" tone="topaz" [size]="15" />
                  <h3>Other queues</h3>
                </div>
              </div>

              <div class="phase-summary-list">
                @for (group of inactivePhaseGroups(); track group.phase) {
                  <section class="inset-panel phase-summary-card">
                    <button type="button" class="phase-summary-toggle" (click)="togglePhaseGroup(group.phase)">
                      <div>
                        <strong>{{ group.label }}</strong>
                        <small>{{ phaseGroupSummary(group) }}</small>
                      </div>
                      <div class="phase-summary-meta">
                        <span class="tag-chip">{{ group.turns.length }}</span>
                        <span class="tag-chip">{{ isPhaseGroupExpanded(group.phase) ? 'Hide' : 'Show' }}</span>
                      </div>
                    </button>

                    @if (isPhaseGroupExpanded(group.phase)) {
                      <div class="list-stack planner-turn-stack compact-phase-stack">
                        @for (turn of group.turns; track turn.id) {
                          <article class="planner-turn-card compact-turn-card" [class.active]="selectedTurnId() === turn.id" [class.turn-complete]="turn.status === 'complete'">
                            <button type="button" class="list-item-button planner-turn-button" (click)="selectTurn(turn)">
                              <div>
                                <strong>{{ participantName(turn.participantId) }}</strong>
                                <small>{{ turn.turnType }} turn · {{ turn.status }}</small>
                              </div>
                              <span>{{ turn.actionsUsed }}/{{ turn.actionsAvailable }}</span>
                            </button>
                          </article>
                        } @empty {
                          <article class="empty-card">Nothing committed here yet.</article>
                        }
                      </div>
                    }
                  </section>
                }
              </div>
            </section>
          } @else {
            <article class="empty-card">This combat has not been started yet.</article>
          }
        </aside>

        <section class="combat-main-stage">
          <section class="card engraved-panel battle-board-panel" data-tour="combat-participants">
            <div class="card-header">
              <div class="section-heading">
                <app-roshar-icon key="sessions" label="Battle board" tone="sapphire" [size]="18" />
                <h3>Battle board</h3>
              </div>
              <div class="ledger-meta">
                @if (selectedParticipant()) {
                  <span class="pill emphasis-pill">Actor {{ selectedParticipant()!.name }}</span>
                }
                @if (selectedTarget()) {
                  <span class="pill">Target {{ selectedTarget()!.name }}</span>
                }
              </div>
            </div>

            <div class="battle-lane-stack">
              @for (lane of battleLanes(); track lane.key) {
                <section class="inset-panel battle-lane compact-battle-lane" [class.opposition-lane]="lane.key === 'opposition'">
                  <div class="battle-lane-header">
                    <div class="section-heading">
                      <app-roshar-icon [key]="lane.key === 'pc' ? 'sessions' : 'combat'" [label]="lane.label" [tone]="lane.tone" [size]="16" />
                      <h3>{{ lane.label }}</h3>
                    </div>
                    <span class="tag-chip">{{ lane.participants.length }}</span>
                  </div>

                  <div class="battle-row-stack">
                    @for (participant of lane.participants; track participant.id) {
                      <app-combat-participant-row
                        [participant]="participant"
                        [tone]="participantTone(participant.side)"
                        [statusLabel]="participantStatusLabel(participant.id)"
                        [reactionLabel]="reactionDetailLabel(participant.id)"
                        [reactionTone]="reactionTone(participant.id)"
                        [turnStatus]="participantTurnStatus(participant.id)"
                        [isActor]="selectedParticipant()?.id === participant.id"
                      [isTarget]="selectedTarget()?.id === participant.id"
                      (selectParticipant)="selectParticipant(participant.id)"
                      (adjustHealth)="adjustHealthFromRow(participant.id, $event)"
                      (adjustFocus)="adjustFocus(participant.id, $event)"
                      (adjustInvestiture)="adjustInvestiture(participant.id, $event)" />
                    }
                  </div>
                </section>
              }
            </div>
          </section>

          <app-combat-resolution-board
            [phaseLabel]="currentRound() ? phaseLabel(currentRound()!.currentPhase) : ''"
            [selectedParticipant]="selectedParticipant()"
            [selectedTurn]="selectedTurn()"
            [selectedParticipantState]="selectedParticipantState()"
            [selectedTarget]="selectedTarget()"
            [supportText]="resolutionSupportText()"
            [resolutionMode]="resolutionMode()"
            [resolutionModes]="resolutionModes"
            [actionForm]="actionForm"
            [conditionForm]="conditionForm"
            [actionChoiceGroups]="activeActionGroups()"
            [selectedActionChoiceId]="selectedActionChoiceId()"
            [loggerTargets]="loggerTargets()"
            [selectedWarnings]="selectedWarnings()"
            [quickD20Values]="quickD20Values"
            [quickCountValues]="quickCountValues"
            [resultChips]="resultChips"
            [commonConditions]="commonConditions"
            [currentActionRequiresTarget]="currentActionRequiresTarget()"
            [currentActionRequiresRoll]="currentActionRequiresRoll()"
            [currentActionSupportsDamage]="currentActionSupportsDamage()"
            [showTargetStripForAction]="currentActionShowsTargetStrip()"
            [showRollFieldsForAction]="currentActionShowsRollFields()"
            [showDamageFieldForAction]="currentActionShowsDamageField()"
            [canCommitSelectedParticipant]="selectedParticipantEligibleNow()"
            [commitLabel]="currentRound() ? commitLabel(currentRound()!.currentPhase) : 'Commit'"
            [canSubmitAction]="canSubmitAction()"
            [canSpendReaction]="!!selectedParticipantState()?.reactionAvailable"
            [canSelectNextTurn]="canSelectNextTurn()"
            [nextTurnLabel]="nextTurnLabel()"
            [submitBlockedReason]="submitBlockedReason()"
            [preferNextTurn]="preferNextTurn()"
            [canCompleteTurn]="selectedTurn()?.status === 'open'"
            [canSaveStrikePreset]="selectedActionMeta()?.source === 'catalog' && selectedActionMeta()?.actionType === 'strike'"
            [logButtonLabel]="logButtonLabel()"
            [showEnemySheetButton]="!!selectedEnemySheet()"
            (resolutionModeChange)="setResolutionMode($event)"
            (actionChoiceSelect)="selectActionChoice($event)"
            (targetSelect)="setTargetId($event)"
            (clearTarget)="clearTarget()"
            (selectRawD20)="setRawD20($event)"
            (clearRawD20)="clearRawD20()"
            (selectHitResult)="setHitResult($event)"
            (selectOpportunityCount)="setOpportunityCount($event)"
            (selectComplicationCount)="setComplicationCount($event)"
            (submitAction)="logAction()"
            (spendReaction)="spendReaction()"
            (selectNextTurn)="selectNextTurn()"
            (completeTurn)="completeSelectedTurn()"
            (commitTurn)="commitSelectedParticipant()"
            (saveStrikePreset)="saveStrikePreset()"
            (addCondition)="addCondition()"
            (removeCondition)="removeCondition(selectedParticipant()!.id, $event)"
            (openEnemySheet)="openEnemySheet()" />

          <section class="card engraved-panel chronicle-feed combat-feed-panel chronicle-drawer" [class.open]="chronicleOpen()" data-tour="combat-feed">
            <div class="card-header">
              <div class="section-heading">
                <app-roshar-icon key="chronicle" label="Battle chronicle" tone="topaz" [size]="18" />
                <h3>Battle chronicle</h3>
              </div>
              <div class="ledger-meta">
                <span class="pill">{{ chronicleEntries().length }}</span>
                <button type="button" class="button-outline micro-button" (click)="chronicleOpen.set(!chronicleOpen())">
                  {{ chronicleOpen() ? 'Collapse' : 'Expand' }}
                </button>
              </div>
            </div>

            @if (chronicleOpen()) {
              <div class="list-stack">
                @for (entry of chronicleEntries(); track entry.id) {
                  <article class="timeline-item chronicle-entry" [class.resource-entry]="entry.category !== 'action'">
                    <strong class="event-line">
                      <app-roshar-icon [key]="entry.icon.key" [label]="entry.icon.label" [tone]="entryTone(entry.icon.tone)" [size]="16" />
                      {{ entry.title }}
                    </strong>
                    <p class="event-line">
                      @if (entry.result) {
                        <app-roshar-icon [key]="entry.result.key" [label]="entry.result.label" [tone]="entryTone(entry.result.tone)" [size]="14" />
                      }
                      {{ entry.detail }}
                    </p>
                    <small>{{ entry.timestamp | date: 'short' }} • {{ entry.note }}</small>
                    @if (entry.category === 'action') {
                      <div class="compact-button-row chronicle-actions">
                        <button type="button" class="button-outline micro-button" (click)="revertAction(entry.id)">Undo</button>
                      </div>
                    }
                  </article>
                } @empty {
                  <article class="empty-card">No actions in the chronicle yet. Commit the first turn or spend a reaction to wake the board.</article>
                }
              </div>
            } @else {
              <article class="empty-card">Chronicle is collapsed so the battle board and resolution board stay clear during live play.</article>
            }
          </section>
        </section>
      </div>
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
  readonly catalogActionChoices = ACTION_CATALOG.map((item) => buildCatalogChoice(item));
  readonly commonConditions = COMMON_CONDITIONS;
  readonly quickD20Values = QUICK_D20_VALUES;
  readonly quickCountValues = QUICK_COUNT_VALUES;
  readonly resultChips = RESULT_CHIPS;
  readonly resolutionModes = RESOLUTION_MODES;
  readonly chronicleOpen = signal(false);
  readonly resolutionMode = signal<ResolutionMode>('action');
  readonly expandedPhaseGroups = signal<CombatPhase[]>(DEFAULT_EXPANDED_PHASES);
  readonly selectedTurnId = signal('');
  readonly selectedParticipantId = signal('');
  readonly selectedActionChoiceId = signal(`${ACTION_CHOICE_PREFIX}${DEFAULT_STRIKE_ACTION_KEY}`);
  readonly actionType = signal(DEFAULT_STRIKE_ACTION_KEY);
  readonly targetId = signal('');

  readonly currentRound = computed(() => {
    const combat = this.store.combat();
    if (!combat) {
      return null;
    }
    return combat.rounds.find((round) => round.roundNumber === combat.currentRoundNumber) ?? combat.rounds.at(-1) ?? null;
  });

  readonly selectedTurn = computed(
    () => this.store.combat()?.turns.find((turn) => turn.id === this.selectedTurnId()) ?? null,
  );

  readonly selectedParticipant = computed(() => {
    const combat = this.store.combat();
    if (!combat) {
      return null;
    }
    const participantId = this.selectedTurn()?.participantId ?? this.selectedParticipantId();
    return combat.participants.find((participant) => participant.id === participantId) ?? null;
  });

  readonly selectedParticipantState = computed(() => {
    const participant = this.selectedParticipant();
    const round = this.currentRound();
    if (!participant || !round) {
      return null;
    }
    return round.participantStates.find((state) => state.participantId === participant.id) ?? null;
  });

  readonly selectedTarget = computed(() => {
    const combat = this.store.combat();
    if (!combat || !this.targetId()) {
      return null;
    }
    return combat.participants.find((participant) => participant.id === this.targetId()) ?? null;
  });

  readonly selectedEnemySheet = computed(() => {
    const participant = this.selectedParticipant();
    if (!participant || (participant.side !== 'enemy' && participant.side !== 'npc') || !participant.imagePath) {
      return null;
    }
    return {
      title: participant.name,
      imagePath: participant.imagePath,
    };
  });

  readonly presetActionChoices = computed(() => (this.selectedParticipant()?.presetActions ?? []).map((action) => buildPresetChoice(action)));

  readonly allActionChoices = computed(() => [...this.catalogActionChoices, ...this.presetActionChoices()]);

  readonly selectedActionMeta = computed(
    () => this.allActionChoices().find((entry) => entry.id === this.selectedActionChoiceId()) ?? null,
  );

  readonly handbookActionChoices = computed(() =>
    sortCatalogWithPriority(
      this.actionCatalog.filter((item) => item.type === 'action' && item.key !== DEFAULT_CUSTOM_ACTION_KEY),
      DEFAULT_STRIKE_ACTION_KEY,
    ).map((item) => buildCatalogChoice(item)),
  );

  readonly handbookFallbackActionChoice = computed(
    () => this.catalogActionChoices.find((entry) => entry.actionType === DEFAULT_CUSTOM_ACTION_KEY) ?? null,
  );

  readonly handbookReactionChoices = computed(() =>
    sortCatalogWithPriority(
      this.actionCatalog.filter((item) => item.type === 'reaction' && item.key !== DEFAULT_REACTION_ACTION_KEY),
      'aid',
    ).map((item) => buildCatalogChoice(item)),
  );

  readonly handbookFallbackReactionChoice = computed(
    () => this.catalogActionChoices.find((entry) => entry.actionType === DEFAULT_REACTION_ACTION_KEY) ?? null,
  );

  readonly freeActionChoices = computed(() =>
    this.catalogActionChoices.filter((entry) => entry.actionKind === 'free').concat(
      this.presetActionChoices().filter((entry) => entry.actionKind === 'free'),
    ),
  );

  readonly presetActionGroups = computed((): ResolutionActionGroup[] => {
    const presetChoices = this.presetActionChoices();
    const groups: ResolutionActionGroup[] = [];
    const presetActions = presetChoices.filter((entry) => entry.actionKind === 'action');
    if (presetActions.length) {
      groups.push({ key: 'preset-actions', label: 'Preset actions', choices: presetActions });
    }
    const presetReactions = presetChoices.filter((entry) => entry.actionKind === 'reaction');
    if (presetReactions.length) {
      groups.push({ key: 'preset-reactions', label: 'Preset reactions', choices: presetReactions });
    }
    return groups;
  });

  readonly actionChoiceGroups = computed<ResolutionActionGroup[]>(() => {
    const groups: ResolutionActionGroup[] = [
      { key: 'handbook-actions', label: 'Handbook', choices: this.handbookActionChoices() },
    ];
    const presetActions = this.presetActionGroups().find((group) => group.key === 'preset-actions');
    if (presetActions) {
      groups.push(presetActions);
    }
    if (this.handbookFallbackActionChoice()) {
      groups.push({ key: 'custom-action', label: 'Fallback', choices: [this.handbookFallbackActionChoice()!] });
    }
    if (this.freeActionChoices().length) {
      groups.push({ key: 'free-actions', label: 'Free', choices: this.freeActionChoices() });
    }
    return groups.filter((group) => group.choices.length);
  });

  readonly reactionChoiceGroups = computed<ResolutionActionGroup[]>(() => {
    const groups: ResolutionActionGroup[] = [
      { key: 'handbook-reactions', label: 'Handbook', choices: this.handbookReactionChoices() },
    ];
    const presetReactions = this.presetActionGroups().find((group) => group.key === 'preset-reactions');
    if (presetReactions) {
      groups.push(presetReactions);
    }
    if (this.handbookFallbackReactionChoice()) {
      groups.push({ key: 'custom-reaction', label: 'Fallback', choices: [this.handbookFallbackReactionChoice()!] });
    }
    return groups.filter((group) => group.choices.length);
  });

  readonly battleLanes = computed<BattleLane[]>(() => {
    const combat = this.store.combat();
    if (!combat) {
      return [];
    }
    return [
      {
        key: 'pc',
        label: 'PCs',
        tone: 'sapphire',
        participants: combat.participants.filter((participant) => participant.side === PLAYER_SIDE),
      },
      {
        key: 'opposition',
        label: 'NPCs and Enemies',
        tone: 'ruby',
        participants: combat.participants.filter((participant) => participant.side !== PLAYER_SIDE),
      },
    ];
  });

  readonly activeActionGroups = computed(() =>
    this.resolutionMode() === 'reaction' ? this.reactionChoiceGroups() : this.actionChoiceGroups(),
  );

  readonly unresolvedParticipants = computed(() => {
    const combat = this.store.combat();
    const round = this.currentRound();
    if (!combat || !round) {
      return [];
    }
    return round.participantStates
      .filter((state) => !state.turnId)
      .map((state) => {
        const participant = combat.participants.find((entry) => entry.id === state.participantId);
        if (!participant) {
          return null;
        }
        return {
          participant,
          state,
          commitState: this.participantCommitState(participant, round.currentPhase, state),
          eligibleNow: this.participantCommitState(participant, round.currentPhase, state) === 'can-commit',
        };
      })
      .filter(
        (
          entry,
        ): entry is {
          participant: CombatRecord['participants'][number];
          state: CombatRound['participantStates'][number];
          commitState: 'can-commit' | 'later' | 'passed' | 'committed';
          eligibleNow: boolean;
        } => Boolean(entry),
      );
  });

  readonly readyParticipants = computed(() => this.unresolvedParticipants().filter((entry) => entry.commitState === 'can-commit'));

  readonly laterParticipants = computed(() => this.unresolvedParticipants().filter((entry) => entry.commitState === 'later'));

  readonly passedParticipants = computed(() => this.unresolvedParticipants().filter((entry) => entry.commitState === 'passed'));

  readonly phaseGroups = computed<PhaseGroup[]>(() => {
    const combat = this.store.combat();
    const round = this.currentRound();
    if (!combat || !round) {
      return [];
    }
    return COMBAT_PHASES.map((phase) => {
      const queue = this.phaseQueue(round, phase);
      return {
        phase,
        label: this.phaseLabel(phase),
        active: round.currentPhase === phase,
        turns: queue
          .map((turnId) => combat.turns.find((turn) => turn.id === turnId))
          .filter((turn): turn is CombatTurn => Boolean(turn)),
      };
    });
  });

  readonly activePhaseGroup = computed(() => this.phaseGroups().find((group) => group.active) ?? null);

  readonly inactivePhaseGroups = computed(() => this.phaseGroups().filter((group) => !group.active));

  readonly chronicleEntries = computed<ChronicleEntry[]>(() => {
    const combat = this.store.combat();
    if (!combat) {
      return [];
    }

    const actionEntries = combat.actionEvents.map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      category: 'action' as const,
      icon: this.actionDescriptor(event.actionType),
      result: this.resultDescriptor(event.hitResult),
      title: `${this.participantName(event.actorId)} used ${event.actionLabel || this.actionName(event.actionType)}`,
      detail: this.actionDetail(event),
      note: event.note || 'No note',
    }));

    const healthEntries = combat.healthEvents.map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      category: 'resource' as const,
      icon: { key: 'health', label: 'Health adjustment', tone: event.delta < 0 ? 'ruby' : 'emerald' },
      result: undefined,
      title: `${this.participantName(event.participantId)} ${event.delta < 0 ? 'lost' : 'gained'} ${Math.abs(event.delta)} HP`,
      detail: event.reason,
      note: 'Health change',
    }));

    const focusEntries = combat.focusEvents.map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      category: 'resource' as const,
      icon: { key: 'focus', label: 'Focus adjustment', tone: event.delta < 0 ? 'topaz' : 'emerald' },
      result: undefined,
      title: `${this.participantName(event.participantId)} ${event.delta < 0 ? 'spent' : 'gained'} ${Math.abs(event.delta)} focus`,
      detail: event.reason,
      note: 'Focus change',
    }));

    const investitureEntries = combat.investitureEvents.map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      category: 'resource' as const,
      icon: { key: 'focus', label: 'Investiture adjustment', tone: event.delta < 0 ? 'sapphire' : 'emerald' },
      result: undefined,
      title: `${this.participantName(event.participantId)} ${event.delta < 0 ? 'spent' : 'gained'} ${Math.abs(event.delta)} investiture`,
      detail: event.reason,
      note: 'Investiture change',
    }));

    const conditionEntries = combat.conditionEvents.map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      category: 'resource' as const,
      icon: { key: 'condition', label: 'Condition update', tone: event.operation === 'add' ? 'emerald' : 'muted' },
      result: undefined,
      title: `${this.participantName(event.participantId)} ${event.operation === 'add' ? 'gained' : 'lost'} ${event.conditionName}`,
      detail: event.note || 'Condition update',
      note: 'Condition change',
    }));

    return [...actionEntries, ...healthEntries, ...focusEntries, ...investitureEntries, ...conditionEntries]
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
      .slice(0, 40);
  });

  readonly selectedWarnings = computed(() => {
    const combat = this.store.combat();
    const turn = this.selectedTurn();
    const action = this.selectedActionMeta();
    if (!combat || !action) {
      return [];
    }

    const warnings: string[] = [];
    if (action.warnOncePerCombat && combat.actionEvents.some((event) => event.actionType === action.actionType)) {
      warnings.push(`${action.label} is already logged in this combat. Treat combat as the scene boundary for now.`);
    }
    if (
      turn &&
      !action.repeatablePerTurn &&
      action.actionKind !== 'reaction' &&
      combat.actionEvents.some((event) => event.turnId === turn.id && event.actionType === action.actionType)
    ) {
      warnings.push(`${action.label} is usually only used once per turn unless an effect says otherwise.`);
    }
    if (this.currentActionRequiresTarget() && !this.selectedTarget()) {
      warnings.push('Pick a target from the battle board before logging this action.');
    }
    return warnings;
  });

  readonly loggerTargets = computed<ResolutionTargetChip[]>(() => {
    const combat = this.store.combat();
    const participant = this.selectedParticipant();
    const action = this.selectedActionMeta();
    if (!combat || !participant || !this.currentActionShowsTargetStrip()) {
      return [];
    }

    const targetSameSide = isSupportTargetAction(action);
    return combat.participants
      .filter((candidate) => {
        if (candidate.id === participant.id) {
          return false;
        }
        return targetSameSide ? candidate.side === participant.side : candidate.side !== participant.side;
      })
      .map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        tone: this.participantTone(candidate.side),
        healthLabel: this.resourceText(candidate.currentHealth, candidate.maxHealth),
        focusLabel: this.resourceText(candidate.currentFocus, candidate.maxFocus),
        investitureLabel:
          (candidate.maxInvestiture ?? 0) > 0 || candidate.currentInvestiture > 0
            ? this.resourceText(candidate.currentInvestiture, candidate.maxInvestiture)
            : undefined,
        active: this.targetId() === candidate.id,
      }));
  });

  readonly resolutionSupportText = computed<ResolutionSupportText>(() => {
    const turn = this.selectedTurn();
    const target = this.selectedTarget();
    const reactionAvailable = this.selectedParticipantState()?.reactionAvailable;

    return {
      actorStatus: this.selectedTurnStateMessage(),
      targetStatus: target
        ? this.targetStatusLabel(target)
        : this.currentActionRequiresTarget()
          ? 'Pick the next target from the strip below.'
          : this.currentActionShowsTargetStrip()
            ? 'Optional target. Pick someone if this action affects a combatant.'
            : 'No target needed for this action.',
      reactionStatus: reactionAvailable ? 'Reaction available' : turn?.status === 'complete' ? 'Reaction window still open' : 'Reaction spent',
    };
  });

  readonly actionForm: CombatActionForm = this.fb.nonNullable.group({
    actionType: [DEFAULT_STRIKE_ACTION_KEY],
    actionKind: ['action' as ActionKind],
    presetActionId: [''],
    actionCost: [1, Validators.min(0)],
    targetId: [''],
    rawD20: [0, [Validators.min(0), Validators.max(20)]],
    modifier: [0],
    hitResult: ['neutral' as HitResult],
    damageAmount: [0, Validators.min(0)],
    focusCost: [0, Validators.min(0)],
    opportunityCount: [0, Validators.min(0)],
    complicationCount: [0, Validators.min(0)],
    damageFormula: [''],
    damageBreakdown: [''],
    note: [''],
  });

  readonly conditionForm: CombatConditionForm = this.fb.nonNullable.group({
    conditionName: [''],
  });

  constructor() {
    const routeSub = this.route.paramMap.subscribe((params) => {
      const combatId = params.get('combatId');
      if (!combatId) {
        return;
      }
      this.combatId.set(combatId);
      void this.store.loadCombat(combatId).then(() => this.syncActionForContext());
    });
    const targetSub = this.actionForm.controls.targetId.valueChanges.subscribe((targetId) => {
      this.targetId.set(targetId);
    });
    this.destroyRef.onDestroy(() => routeSub.unsubscribe());
    this.destroyRef.onDestroy(() => targetSub.unsubscribe());
  }

  participantName(participantId: string): string {
    return this.store.combat()?.participants.find((participant) => participant.id === participantId)?.name ?? 'Unknown';
  }

  actionName(actionType: string): string {
    return this.actionCatalog.find((entry) => entry.key === actionType)?.name ?? actionType;
  }

  actionDescriptor(actionType: string) {
    return actionIcon(actionType, this.actionName(actionType));
  }

  actionDetail(event: CombatRecord['actionEvents'][number]): string {
    const details: string[] = [event.hitResult || 'neutral'];
    if (event.damageAmount) {
      details.push(`damage ${event.damageAmount}`);
    }
    if (event.damageFormula) {
      details.push(`formula ${event.damageFormula}`);
    }
    if (event.damageBreakdown) {
      details.push(`roll ${event.damageBreakdown}`);
    }
    if (event.focusCost) {
      details.push(`focus ${event.focusCost}`);
    }
    return details.join(' • ');
  }

  resultDescriptor(result: string | undefined) {
    return resultIcon(result);
  }

  entryTone(tone: string | undefined) {
    switch (tone) {
      case 'default':
      case 'gold':
      case 'sapphire':
      case 'emerald':
      case 'ruby':
      case 'topaz':
      case 'muted':
        return tone;
      default:
        return 'muted';
    }
  }

  participantTone(side: string) {
    return side === 'enemy' || side === 'npc' ? 'ruby' : 'sapphire';
  }

  phaseLabel(phase: CombatPhase): string {
    switch (phase) {
      case 'fast-pc':
        return 'Fast PC';
      case 'fast-npc':
        return 'Fast NPC';
      case 'slow-pc':
        return 'Slow PC';
      case 'slow-npc':
        return 'Slow NPC';
    }
  }

  phaseIcon(phase: CombatPhase): string {
    return phase.startsWith('fast') ? 'fast' : 'slow';
  }

  phaseTone(phase: CombatPhase): 'topaz' | 'ruby' | 'sapphire' {
    if (phase.startsWith('fast')) {
      return 'topaz';
    }
    return phase.endsWith('npc') ? 'ruby' : 'sapphire';
  }

  commitLabel(phase: CombatPhase): string {
    return phase.startsWith('fast') ? 'Commit Fast' : 'Commit Slow';
  }

  waitingLabel(participantId: string): string {
    const combat = this.store.combat();
    const round = this.currentRound();
    const participant = combat?.participants.find((entry) => entry.id === participantId);
    if (!participant || !round) {
      return 'Waiting';
    }

    if (participant.side === PLAYER_SIDE) {
      switch (round.currentPhase) {
        case 'fast-npc':
          return WAITING_FOR_SLOW_PC_LABEL;
        case 'slow-npc':
          return PHASE_PASSED_THIS_ROUND_LABEL;
        default:
          return 'Waiting';
      }
    }

    switch (round.currentPhase) {
      case 'fast-pc':
        return WAITING_FOR_FAST_NPC_LABEL;
      case 'slow-pc':
        return WAITING_FOR_SLOW_NPC_LABEL;
      default:
        return 'Waiting';
    }
  }

  phaseQueue(round: CombatRound, phase: CombatPhase): string[] {
    switch (phase) {
      case 'fast-pc':
        return round.fastPCQueueIds;
      case 'fast-npc':
        return round.fastNPCQueueIds;
      case 'slow-pc':
        return round.slowPCQueueIds;
      case 'slow-npc':
        return round.slowNPCQueueIds;
    }
  }

  participantTurnStatus(participantId: string): CombatTurn['status'] | 'uncommitted' {
    const state = this.currentRound()?.participantStates.find((entry) => entry.participantId === participantId);
    return state?.turnStatus ?? 'uncommitted';
  }

  participantStatusLabel(participantId: string): string {
    const state = this.currentRound()?.participantStates.find((entry) => entry.participantId === participantId);
    if (!state?.turnId) {
      return this.commitStatusLabel(participantId);
    }
    return state.turnStatus === 'complete' ? 'Turn complete' : `${state.turnType} turn open`;
  }

  reactionDetailLabel(participantId: string): string {
    return this.currentRound()?.participantStates.find((entry) => entry.participantId === participantId)?.reactionAvailable
      ? 'Reaction available'
      : 'Reaction spent';
  }

  reactionTone(participantId: string): 'emerald' | 'ruby' {
    return this.currentRound()?.participantStates.find((entry) => entry.participantId === participantId)?.reactionAvailable
      ? 'emerald'
      : 'ruby';
  }

  currentActionRequiresTarget(): boolean {
    return Boolean(this.selectedActionMeta()?.requiresTarget);
  }

  currentActionRequiresRoll(): boolean {
    return Boolean(this.selectedActionMeta()?.requiresRoll);
  }

  currentActionSupportsDamage(): boolean {
    return Boolean(this.selectedActionMeta()?.supportsDamage);
  }

  currentActionShowsTargetStrip(): boolean {
    return this.currentActionRequiresTarget() || this.isFlexibleCustomAction();
  }

  currentActionShowsRollFields(): boolean {
    return this.currentActionRequiresRoll() || this.isFlexibleCustomAction();
  }

  currentActionShowsDamageField(): boolean {
    return this.currentActionSupportsDamage() || this.isFlexibleCustomAction();
  }

  resourceText(current: number | undefined, max: number | undefined): string {
    if (current === undefined) {
      return '-';
    }
    return max !== undefined ? `${current}/${max}` : `${current}`;
  }

  currentPhaseOpenTurns(): CombatTurn[] {
    const combat = this.store.combat();
    const round = this.currentRound();
    if (!combat || !round) {
      return [];
    }
    return this.phaseQueue(round, round.currentPhase)
      .map((turnId) => combat.turns.find((turn) => turn.id === turnId))
      .filter((turn): turn is CombatTurn => turn !== undefined && turn.status === 'open');
  }

  currentPhaseBlockingOpenTurns(): CombatTurn[] {
    return this.currentPhaseOpenTurns().filter((turn) => turn.actionsUsed < turn.actionsAvailable);
  }

  currentPhaseExhaustedOpenTurns(): CombatTurn[] {
    return this.currentPhaseOpenTurns().filter((turn) => turn.actionsUsed >= turn.actionsAvailable);
  }

  canAdvancePhase(): boolean {
    const combat = this.store.combat();
    if (!combat || combat.status !== 'active') {
      return false;
    }
    return this.currentPhaseBlockingOpenTurns().length === 0;
  }

  advanceStatusLabel(): string {
    const blockingCount = this.currentPhaseBlockingOpenTurns().length;
    if (blockingCount > 0) {
      return blockingCount === 1 ? 'Open turn 1' : `Open turns ${blockingCount}`;
    }

    const exhaustedCount = this.currentPhaseExhaustedOpenTurns().length;
    if (exhaustedCount > 0) {
      return exhaustedCount === 1 ? 'Ready to close 1' : `Ready to close ${exhaustedCount}`;
    }

    return 'Ready to advance';
  }

  advancePhaseGuidance(): string {
    const blockingTurns = this.currentPhaseBlockingOpenTurns();
    if (blockingTurns.length > 0) {
      const firstTurn = blockingTurns[0];
      return `${this.participantName(firstTurn.participantId)} still has actions remaining in this phase.`;
    }

    const exhaustedTurns = this.currentPhaseExhaustedOpenTurns();
    if (exhaustedTurns.length > 0) {
      return 'Exhausted turns will auto-close when you advance the phase.';
    }

    return 'Only open turns with actions remaining block phase advance.';
  }

  canSubmitAction(): boolean {
    const participant = this.selectedParticipant();
    const action = this.selectedActionMeta();
    if (!participant || !action) {
      return false;
    }
    if (this.currentActionRequiresTarget() && !this.selectedTarget()) {
      return false;
    }
    if (this.currentActionRequiresRoll()) {
      const rawD20 = this.actionForm.controls.rawD20.value;
      if (rawD20 < 1 || rawD20 > 20) {
        return false;
      }
    }
    if (action.actionKind === 'reaction') {
      return Boolean(this.selectedParticipantState()?.reactionAvailable);
    }
    const turn = this.selectedTurn();
    if (action.actionKind === 'free') {
      return turn?.status === 'open';
    }
    return Boolean(
      turn?.status === 'open' &&
      turn.actionsUsed + this.actionForm.controls.actionCost.value <= turn.actionsAvailable,
    );
  }

  logButtonLabel(): string {
    const action = this.selectedActionMeta();
    if (!action) {
      return 'Log action';
    }
    if (this.turnExhausted() && action.actionKind === 'action') {
      return 'No actions left';
    }
    return `Log ${action.label}`;
  }

  selectedTurnStateMessage(): string {
    const turn = this.selectedTurn();
    const participant = this.selectedParticipant();
    if (turn?.status === 'open') {
      if (turn.actionsUsed >= turn.actionsAvailable) {
        return this.nextOpenTurnCandidate()
          ? 'Actions spent. Move to the next open turn or advance the phase to close this one.'
          : 'Actions spent. End the turn or advance the phase to close it.';
      }
      return `${turn.actionsUsed}/${turn.actionsAvailable} actions spent. Keep resolving from this board until the turn ends.`;
    }
    if (turn?.status === 'complete') {
      return 'Turn is complete. You can still log a reaction if one is available.';
    }
    if (this.selectedParticipantEligibleNow()) {
      return `${this.commitLabel(this.currentRound()!.currentPhase)} to start this combatant’s turn in the current phase.`;
    }
    if (participant) {
      return this.commitStatusLabel(participant.id);
    }
    return 'Waiting for combat to start.';
  }

  canSelectNextTurn(): boolean {
    return Boolean(this.nextOpenTurnCandidate());
  }

  nextTurnLabel(): string {
    const nextTurn = this.nextOpenTurnCandidate();
    return nextTurn ? `Next turn: ${this.participantName(nextTurn.participantId)}` : 'Next turn';
  }

  preferNextTurn(): boolean {
    return this.turnExhausted() && this.canSelectNextTurn();
  }

  submitBlockedReason(): string {
    const participant = this.selectedParticipant();
    const action = this.selectedActionMeta();
    if (!participant || !action) {
      return '';
    }

    if (this.turnExhausted() && action.actionKind === 'action') {
      if (this.canSelectNextTurn()) {
        return `${participant.name} has no actions left. ${action.label} costs actions, so move to ${this.nextTurnLabel()} or end this turn.`;
      }
      return `${participant.name} has no actions left. ${action.label} costs actions, so end this turn or advance the phase.`;
    }

    return '';
  }

  async startCombat(): Promise<void> {
    await this.store.startCombat(this.combatId());
    this.selectFirstEligibleUnresolvedParticipant();
  }

  async finishCombat(): Promise<void> {
    await this.store.finishCombat(this.combatId());
  }

  selectParticipant(participantId: string): void {
    this.selectedParticipantId.set(participantId);
    const turnId = this.currentRound()?.participantStates.find((state) => state.participantId === participantId)?.turnId;
    this.selectedTurnId.set(turnId ?? '');
    this.clearTarget();
    this.syncActionForContext();
  }

  selectTurn(turn: CombatTurn): void {
    this.selectedTurnId.set(turn.id);
    this.selectedParticipantId.set(turn.participantId);
    this.clearTarget();
    this.syncActionForContext();
  }

  async commitParticipant(participantId: string): Promise<void> {
    await this.store.commitCurrentRound(this.combatId(), { participantId });
    const round = this.currentRound();
    const turnId = round?.participantStates.find((state) => state.participantId === participantId)?.turnId;
    this.selectedParticipantId.set(participantId);
    this.selectedTurnId.set(turnId ?? '');
    this.clearTarget();
    this.resolutionMode.set('action');
    this.syncActionForContext();
  }

  async commitSelectedParticipant(): Promise<void> {
    const participant = this.selectedParticipant();
    if (!participant || !this.selectedParticipantEligibleNow()) {
      return;
    }
    await this.commitParticipant(participant.id);
  }

  async advancePhase(): Promise<void> {
    await this.store.advanceCurrentPhase(this.combatId());
    this.selectFirstEligibleUnresolvedParticipant();
  }

  async moveTurn(phase: CombatPhase, turnId: string, direction: -1 | 1): Promise<void> {
    const round = this.currentRound();
    if (!round) {
      return;
    }
    const orderedTurnIds = [...this.phaseQueue(round, phase)];
    const currentIndex = orderedTurnIds.indexOf(turnId);
    const nextIndex = currentIndex + direction;
    if (currentIndex === -1 || nextIndex < 0 || nextIndex >= orderedTurnIds.length) {
      return;
    }
    const [moved] = orderedTurnIds.splice(currentIndex, 1);
    orderedTurnIds.splice(nextIndex, 0, moved);
    await this.store.reorderCurrentRound(this.combatId(), { phase, orderedTurnIds });
  }

  async completeSelectedTurn(): Promise<void> {
    const turn = this.selectedTurn();
    if (!turn) {
      return;
    }
    const phase = turn.phase;
    await this.store.completeTurn(this.combatId(), turn.id);
    this.selectNextOpenTurn(phase);
    this.syncActionForContext();
  }

  selectNextTurn(): void {
    const nextTurn = this.nextOpenTurnCandidate();
    if (!nextTurn) {
      return;
    }
    this.selectTurn(nextTurn);
  }

  async logAction(): Promise<void> {
    const combat = this.store.combat();
    const round = this.currentRound();
    const participant = this.selectedParticipant();
    const action = this.selectedActionMeta();
    if (!combat || !round || !participant || !action || !this.canSubmitAction()) {
      return;
    }

    const raw = this.actionForm.getRawValue();
    const target = this.selectedTarget();
    const rawD20 = raw.rawD20;
    await this.store.logAction(this.combatId(), {
      roundId: round.id,
      turnId: this.selectedTurn()?.id || undefined,
      actorId: participant.id,
      actionType: raw.actionType,
      actionKind: raw.actionKind,
      presetActionId: raw.presetActionId || undefined,
      targetIds: raw.targetId ? [raw.targetId] : [],
      actionCost: raw.actionCost,
      focusCost: raw.focusCost,
      hitResult: raw.hitResult,
      damageAmount: raw.damageAmount,
      damageFormula: raw.damageFormula.trim() || undefined,
      damageBreakdown: raw.damageBreakdown.trim() || undefined,
      note: raw.note.trim() || undefined,
      linkedRoll:
        rawD20 > 0
          ? {
              actorId: participant.participantId,
              actorName: participant.name,
              targetId: target?.participantId,
              targetName: target?.name,
              roundNumber: round.roundNumber,
              rollCategory: this.currentActionSupportsDamage() ? 'attack' : 'generic',
              rawD20,
              modifier: raw.modifier,
              opportunityCount: raw.opportunityCount,
              complicationCount: raw.complicationCount,
              outcome: this.rollOutcomeFromHitResult(raw.hitResult),
              note: raw.note.trim() || undefined,
            }
          : undefined,
    });

    this.actionForm.patchValue(
      {
        rawD20: 0,
        hitResult: action.tags.includes('support') ? 'support' : 'neutral',
        damageAmount: 0,
        opportunityCount: 0,
        complicationCount: 0,
        damageBreakdown: '',
        note: '',
      },
      { emitEvent: false },
    );
    this.clearTarget();
  }

  async saveStrikePreset(): Promise<void> {
    const participant = this.selectedParticipant();
    if (!participant) {
      return;
    }
    await this.store.updateStrikePreset(this.combatId(), participant.id, {
      attackModifier: this.actionForm.controls.modifier.value,
      damageFormula: this.actionForm.controls.damageFormula.value.trim() || undefined,
      defaultFocusCost: this.actionForm.controls.focusCost.value,
    });
  }

  async spendReaction(): Promise<void> {
    const participant = this.selectedParticipant();
    if (!participant) {
      return;
    }
    await this.store.spendReaction(this.combatId(), participant.id);
  }

  async adjustHealth(participantId: string, delta: number, reason = QUICK_DAMAGE_REASON): Promise<void> {
    await this.store.logHealth(this.combatId(), { participantId, delta, reason });
  }

  async adjustFocus(participantId: string, delta: number): Promise<void> {
    await this.store.logFocus(this.combatId(), { participantId, delta, reason: MANUAL_FOCUS_REASON });
  }

  async adjustInvestiture(participantId: string, delta: number): Promise<void> {
    await this.store.logInvestiture(this.combatId(), { participantId, delta, reason: MANUAL_INVESTITURE_REASON });
  }

  async removeCondition(participantId: string, conditionName: string): Promise<void> {
    await this.store.logCondition(this.combatId(), { participantId, conditionName, operation: 'remove' });
  }

  async addCondition(): Promise<void> {
    const participant = this.selectedParticipant();
    const conditionName = this.conditionForm.controls.conditionName.value.trim();
    if (!participant || !conditionName) {
      return;
    }
    await this.store.logCondition(this.combatId(), { participantId: participant.id, conditionName, operation: 'add' });
    this.conditionForm.patchValue({ conditionName: '' });
  }

  openEnemySheet(): void {
    const sheet = this.selectedEnemySheet();
    if (!sheet) {
      return;
    }
    window.open(sheet.imagePath, '_blank', 'noopener,noreferrer');
  }

  async revertAction(actionEventId: string): Promise<void> {
    await this.store.revertAction(this.combatId(), actionEventId);
  }

  setResolutionMode(mode: ResolutionMode): void {
    this.resolutionMode.set(mode);
    this.selectDefaultActionChoice(mode);
  }

  setRawD20(value: number): void {
    this.actionForm.patchValue({ rawD20: value }, { emitEvent: false });
  }

  clearRawD20(): void {
    this.actionForm.patchValue({ rawD20: 0 }, { emitEvent: false });
  }

  setHitResult(value: HitResult): void {
    this.actionForm.patchValue({ hitResult: value }, { emitEvent: false });
  }

  setOpportunityCount(value: number): void {
    this.actionForm.patchValue({ opportunityCount: value }, { emitEvent: false });
  }

  setComplicationCount(value: number): void {
    this.actionForm.patchValue({ complicationCount: value }, { emitEvent: false });
  }

  clearTarget(): void {
    this.setTargetId('');
  }

  async adjustHealthFromRow(participantId: string, delta: number): Promise<void> {
    const reason = delta < 0 ? QUICK_DAMAGE_REASON : QUICK_HEALING_REASON;
    await this.adjustHealth(participantId, delta, reason);
  }

  commitStatusLabel(participantId: string): string {
    const combat = this.store.combat();
    const round = this.currentRound();
    const participant = combat?.participants.find((entry) => entry.id === participantId);
    const state = round?.participantStates.find((entry) => entry.participantId === participantId);
    if (!participant || !round) {
      return 'Waiting';
    }

    switch (this.participantCommitState(participant, round.currentPhase, state)) {
      case 'can-commit':
        return CAN_COMMIT_NOW_LABEL;
      case 'later':
      case 'passed':
        return this.waitingLabel(participantId);
      case 'committed':
        return TURN_ALREADY_COMMITTED_LABEL;
    }
  }

  selectedParticipantEligibleNow(): boolean {
    const participant = this.selectedParticipant();
    const round = this.currentRound();
    const state = this.selectedParticipantState();
    if (!participant || !round) {
      return false;
    }
    return this.participantCommitState(participant, round.currentPhase, state) === 'can-commit';
  }

  private clearSelection(): void {
    this.selectedParticipantId.set('');
    this.selectedTurnId.set('');
    this.clearTarget();
  }

  togglePhaseGroup(phase: CombatPhase): void {
    const expanded = this.expandedPhaseGroups();
    this.expandedPhaseGroups.set(
      expanded.includes(phase) ? expanded.filter((entry) => entry !== phase) : [...expanded, phase],
    );
  }

  isPhaseGroupExpanded(phase: CombatPhase): boolean {
    return this.expandedPhaseGroups().includes(phase);
  }

  phaseGroupSummary(group: PhaseGroup): string {
    if (!group.turns.length) {
      return 'No committed turns';
    }
    if (group.turns.length === 1) {
      return `${this.participantName(group.turns[0].participantId)} queued`;
    }
    return `${group.turns.length} turns queued`;
  }

  selectActionChoice(choiceId: string): void {
    const choice = this.allActionChoices().find((entry) => entry.id === choiceId);
    if (!choice) {
      return;
    }
    this.selectedActionChoiceId.set(choice.id);
    this.actionType.set(choice.actionType);
    this.actionForm.patchValue(
      {
        actionType: choice.actionType,
        actionKind: choice.actionKind,
        presetActionId: choice.presetActionId ?? '',
      },
      { emitEvent: false },
    );
    this.applyActionDefaults(choice);
  }

  setTargetId(targetId: string): void {
    this.targetId.set(targetId);
    this.actionForm.patchValue({ targetId }, { emitEvent: false });
  }

  private isEligibleForCurrentPhase(participant: CombatRecord['participants'][number], phase: CombatPhase): boolean {
    return PC_PHASES.includes(phase) ? participant.side === PLAYER_SIDE : participant.side !== PLAYER_SIDE;
  }

  private isEligibleForCurrentPhaseId(participantId: string): boolean {
    const participant = this.store.combat()?.participants.find((entry) => entry.id === participantId);
    const round = this.currentRound();
    if (!participant || !round) {
      return false;
    }
    return this.isEligibleForCurrentPhase(participant, round.currentPhase);
  }

  private participantCommitState(
    participant: CombatRecord['participants'][number],
    phase: CombatPhase,
    state?: CombatRound['participantStates'][number] | null,
  ): 'can-commit' | 'later' | 'passed' | 'committed' {
    if (state?.turnId) {
      return 'committed';
    }

    if (this.isEligibleForCurrentPhase(participant, phase)) {
      return 'can-commit';
    }

    if (participant.side === PLAYER_SIDE) {
      return phase === 'slow-npc' ? 'passed' : 'later';
    }

    return 'later';
  }

  private selectNextOpenTurn(phase: CombatPhase): void {
    const group = this.phaseGroups().find((entry) => entry.phase === phase);
    const nextTurn = group?.turns.find((turn) => turn.status === 'open') ?? null;
    if (nextTurn) {
      this.selectTurn(nextTurn);
      return;
    }
    this.selectFirstEligibleUnresolvedParticipant();
  }

  private syncActionForContext(): void {
    const participant = this.selectedParticipant();
    const turn = this.selectedTurn();
    const nextMode: ResolutionMode =
      turn?.status === 'open' || this.selectedParticipantEligibleNow() ? 'action' : 'reaction';
    this.resolutionMode.set(participant ? nextMode : 'action');
    this.selectDefaultActionChoice(participant ? nextMode : 'action');
    this.normalizeTargetForSelectedParticipant();
  }

  private nextOpenTurnCandidate(): CombatTurn | null {
    const selectedTurn = this.selectedTurn();
    const round = this.currentRound();
    if (!selectedTurn || selectedTurn.status !== 'open' || !round) {
      return null;
    }
    if (selectedTurn.actionsUsed < selectedTurn.actionsAvailable) {
      return null;
    }

    const activeGroup = this.phaseGroups().find((group) => group.phase === round.currentPhase);
    if (!activeGroup) {
      return null;
    }

    return (
      activeGroup.turns.find(
        (turn) =>
          turn.id !== selectedTurn.id && turn.status === 'open' && turn.actionsUsed < turn.actionsAvailable,
      ) ?? null
    );
  }

  private turnExhausted(): boolean {
    const turn = this.selectedTurn();
    return Boolean(turn?.status === 'open' && turn.actionsUsed >= turn.actionsAvailable);
  }

  private isFlexibleCustomAction(): boolean {
    const action = this.selectedActionMeta();
    return Boolean(action?.source === 'catalog' && CUSTOM_ACTION_KEYS.has(action.actionType));
  }

  private selectFirstEligibleUnresolvedParticipant(): void {
    const firstEligible = this.readyParticipants()[0]?.participant ?? null;
    if (firstEligible) {
      this.selectParticipant(firstEligible.id);
      return;
    }
    this.clearSelection();
    this.syncActionForContext();
  }

  private normalizeTargetForSelectedParticipant(): void {
    const participant = this.selectedParticipant();
    if (!participant) {
      this.clearTarget();
      return;
    }
    if (this.targetId() === participant.id) {
      this.clearTarget();
    }
  }

  private targetStatusLabel(target: CombatParticipantState): string {
    const parts = [
      `${this.resourceText(target.currentHealth, target.maxHealth)} HP`,
      `${this.resourceText(target.currentFocus, target.maxFocus)} focus`,
    ];
    if ((target.maxInvestiture ?? 0) > 0 || target.currentInvestiture > 0) {
      parts.push(`${this.resourceText(target.currentInvestiture, target.maxInvestiture)} investiture`);
    }
    return parts.join(' · ');
  }

  private applyActionDefaults(action: ResolutionActionChoice): void {
    const strikePreset = this.selectedParticipant()?.defaultStrikePreset;
    const isStrike = action.source === 'catalog' && action.actionType === DEFAULT_STRIKE_ACTION_KEY;
    const defaultFocusCost = isStrike
      ? strikePreset?.defaultFocusCost ?? action.defaultFocusCost
      : action.defaultFocusCost;

    this.actionForm.patchValue(
      {
        actionType: action.actionType,
        actionKind: action.actionKind,
        presetActionId: action.presetActionId ?? '',
        actionCost: action.defaultActionCost,
        focusCost: defaultFocusCost,
        modifier: isStrike ? strikePreset?.attackModifier ?? 0 : action.defaultModifier ?? 0,
        hitResult: action.tags.includes('support') ? 'support' : 'neutral',
        damageFormula: isStrike ? strikePreset?.damageFormula ?? '' : action.defaultDamageFormula ?? '',
        damageAmount: 0,
        rawD20: 0,
        opportunityCount: 0,
        complicationCount: 0,
        damageBreakdown: '',
        note: '',
      },
      { emitEvent: false },
    );
  }

  private selectDefaultActionChoice(mode: ResolutionMode): void {
    const defaultChoice =
      mode === 'reaction'
        ? this.handbookFallbackReactionChoice() ?? this.handbookReactionChoices()[0] ?? null
        : this.handbookActionChoices().find((choice) => choice.actionType === DEFAULT_STRIKE_ACTION_KEY) ??
          this.handbookActionChoices()[0] ??
          this.handbookFallbackActionChoice() ??
          null;

    if (!defaultChoice) {
      return;
    }
    this.selectActionChoice(defaultChoice.id);
  }

  private rollOutcomeFromHitResult(hitResult: HitResult) {
    switch (hitResult) {
      case 'criticalHit':
        return 'criticalSuccess' as const;
      case 'criticalMiss':
        return 'criticalFailure' as const;
      case 'graze':
        return 'graze' as const;
      case 'hit':
        return 'success' as const;
      case 'miss':
        return 'failure' as const;
      default:
        return 'neutral' as const;
    }
  }
}
