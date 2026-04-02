import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CombatParticipantState, CombatRoundParticipantState, CombatTurn, HitResult } from '@shared/domain';
import { RosharIconComponent } from '../../shared/roshar-icon.component';
import {
  CombatActionForm,
  CombatConditionForm,
  ResolutionActionGroup,
  ResolutionMode,
  ResolutionModeOption,
  ResolutionSupportText,
  ResolutionTargetChip,
  ResultChip,
} from './combat-tracker.types';

@Component({
  selector: 'app-combat-resolution-board',
  imports: [CommonModule, ReactiveFormsModule, RosharIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card engraved-panel resolution-board" data-tour="combat-action-logger">
      <div class="card-header compact-card-header">
        <div class="section-heading">
          <app-roshar-icon key="combat" label="Resolution board" tone="gold" [size]="18" />
          <h3>Resolution board</h3>
        </div>
        @if (phaseLabel()) {
          <span class="pill emphasis-pill">{{ phaseLabel() }}</span>
        }
      </div>

      @if (selectedParticipant(); as participant) {
        <section class="logger-hero-strip inset-panel">
          <div class="logger-hero-block">
            <span class="stat-label">Actor</span>
            <strong class="event-line">
              <app-roshar-icon key="sessions" [label]="participant.name" [tone]="participantTone()" [size]="16" />
              {{ participant.name }}
            </strong>
            <small>{{ supportText().actorStatus }}</small>
          </div>

          <div class="logger-hero-block">
            <span class="stat-label">Reaction</span>
            <strong>{{ supportText().reactionStatus }}</strong>
            <small>Separate from actions</small>
          </div>

          <div class="logger-hero-block">
            <span class="stat-label">Target</span>
            <strong>{{ selectedTarget()?.name || 'No target' }}</strong>
            <small>{{ supportText().targetStatus }}</small>
          </div>

          <div class="logger-hero-block logger-hero-block--turn">
            <span class="stat-label">Turn</span>
            <strong>{{ turnSummaryLabel() }}</strong>
            <small>{{ turnSummaryNote() }}</small>
          </div>
        </section>

        <div class="logger-mode-tabs" role="tablist" aria-label="Resolution mode">
          @for (mode of resolutionModes(); track mode.key) {
            <button
              type="button"
              class="button-outline logger-mode-tab"
              [class.active]="resolutionMode() === mode.key"
              (click)="setResolutionMode(mode.key)">
              {{ mode.label }}
            </button>
          }
        </div>

        <div class="logger-action-toolbar">
          @if (canCommitSelectedParticipant()) {
            <button type="button" (click)="commitTurn.emit()">{{ commitLabel() }}</button>
          }
          <span class="tag-chip" [class.emphasis-pill]="selectedParticipantState()?.reactionAvailable">
            {{ selectedParticipantState()?.reactionAvailable ? 'Reaction available' : 'Reaction spent' }}
          </span>
          @if (selectedWarnings().length) {
            <div class="logger-warning-strip">
              @for (warning of selectedWarnings(); track warning) {
                <span class="logger-warning-chip">{{ warning }}</span>
              }
            </div>
          }
        </div>

        <form class="logger-form" [formGroup]="actionForm()" (ngSubmit)="submitAction.emit()">
          @if (submitBlockedReason()) {
            <section class="inset-panel logger-blocked-note">
              <strong>Action blocked</strong>
              <p>{{ submitBlockedReason() }}</p>
            </section>
          }

          @if (showTargetStrip()) {
            <section class="inset-panel logger-target-strip">
              <div class="logger-target-strip-header">
                <span class="stat-label">Target</span>
                @if (selectedTarget()) {
                  <button type="button" class="button-outline micro-button" (click)="clearTarget.emit()">Clear</button>
                }
              </div>
              <div class="logger-target-chip-grid">
                @for (target of loggerTargets(); track target.id) {
                  <button
                    type="button"
                    class="button-outline logger-target-chip"
                    [class.active]="target.active"
                    (click)="targetSelect.emit(target.id)">
                    <span>{{ target.name }}</span>
                    <small>
                      <span>{{ target.healthLabel }}</span>
                      <span> · </span>
                      <span class="focus-text">{{ target.focusLabel }}</span>
                    </small>
                  </button>
                } @empty {
                  <span class="muted">No legal targets for this action.</span>
                }
              </div>
            </section>
          }

          <section class="logger-fast-shell inset-panel">
            <div class="logger-choice-stack">
              @for (group of actionChoiceGroups(); track group.key) {
                <div class="logger-choice-group">
                  <span class="stat-label">{{ group.label }}</span>
                  <div class="logger-choice-chip-grid">
                    @for (choice of group.choices; track choice.id) {
                      <button
                        type="button"
                        class="button-outline logger-choice-chip"
                        [class.active]="selectedActionChoiceId() === choice.id"
                        (click)="actionChoiceSelect.emit(choice.id)">
                        {{ choice.label }}
                      </button>
                    }
                  </div>
                </div>
              }
            </div>

            <div class="logger-fast-grid">
              @if (showRollFields()) {
                <label class="compact-field logger-compact-field">
                  <span>Modifier</span>
                  <input formControlName="modifier" type="number" />
                </label>
              }

              @if (showDamageField()) {
                <label class="compact-field logger-compact-field">
                  <span>Damage</span>
                  <input formControlName="damageAmount" type="number" min="0" />
                </label>
              }

              @if (showRollFields()) {
                <div class="logger-outcome-strip">
                  <span class="stat-label">Outcome</span>
                  <div class="resolution-chip-grid">
                    @for (chip of resultChips(); track chip.value) {
                      <button
                        type="button"
                        class="button-outline outcome-chip compact-chip"
                        [class.active]="actionForm().controls.hitResult.value === chip.value"
                        (click)="selectHitResult.emit(chip.value)">
                        {{ chip.label }}
                      </button>
                    }
                  </div>
                </div>

                <div class="logger-counter-strip">
                  <span class="stat-label">Opp</span>
                  <div class="resolution-chip-grid">
                    @for (value of quickCountValues(); track value) {
                      <button
                        type="button"
                        class="button-outline micro-button"
                        [class.active]="actionForm().controls.opportunityCount.value === value"
                        (click)="selectOpportunityCount.emit(value)">
                        {{ value }}
                      </button>
                    }
                  </div>
                </div>

                <div class="logger-counter-strip">
                  <span class="stat-label">Comp</span>
                  <div class="resolution-chip-grid">
                    @for (value of quickCountValues(); track value) {
                      <button
                        type="button"
                        class="button-outline micro-button"
                        [class.active]="actionForm().controls.complicationCount.value === value"
                        (click)="selectComplicationCount.emit(value)">
                        {{ value }}
                      </button>
                    }
                  </div>
                </div>
              }
            </div>

            @if (showRollFields()) {
              <div class="logger-d20-shell">
                <div class="logger-d20-copy">
                  <span class="stat-label">Raw d20</span>
                  <strong>{{ actionForm().controls.rawD20.value > 0 ? actionForm().controls.rawD20.value : 'Not set' }}</strong>
                </div>
                <div class="exact-d20-row compact-d20-grid logger-d20-grid">
                  @for (value of quickD20Values(); track value) {
                    <button
                      type="button"
                      class="button-outline micro-button"
                      [class.active]="actionForm().controls.rawD20.value === value"
                      [class.edge-roll]="value === 1 || value === 20"
                      (click)="selectRawD20.emit(value)">
                      {{ value }}
                    </button>
                  }
                </div>
                <button type="button" class="button-outline micro-button" (click)="clearRawD20.emit()">Clear d20</button>
              </div>
            }

            <div class="logger-primary-actions">
              <button
                type="submit"
                [disabled]="!canSubmitAction()"
                [class.button-outline]="preferNextTurn()">
                {{ logButtonLabel() }}
              </button>
              <button type="button" class="button-outline" [disabled]="!canSpendReaction()" (click)="spendReaction.emit()">
                Spend reaction
              </button>
              @if (canSelectNextTurn()) {
                <button
                  type="button"
                  [class.button-outline]="!preferNextTurn()"
                  (click)="selectNextTurn.emit()">
                  {{ nextTurnLabel() }}
                </button>
              }
              @if (canCompleteTurn()) {
                <button type="button" class="button-outline" (click)="completeTurn.emit()">End turn</button>
              }
            </div>
          </section>

          <section class="logger-details inset-panel">
            <div class="logger-details-header">
              <div>
                <span class="stat-label">Details</span>
                <strong>{{ detailsSummaryLabel() }}</strong>
              </div>
              <div class="button-row">
                @if (showEnemySheetButton()) {
                  <button type="button" class="button-outline micro-button" (click)="openEnemySheet.emit()">Enemy sheet</button>
                }
                <button type="button" class="button-outline micro-button" (click)="toggleDetails()">
                  {{ detailsOpen() ? 'Hide details' : 'Show details' }}
                </button>
              </div>
            </div>

            @if (detailsOpen()) {
              <div class="logger-details-grid">
                <label class="compact-field">
                  <span>Action cost</span>
                  <input formControlName="actionCost" type="number" min="0" />
                </label>

                <label class="compact-field">
                  <span>Focus cost</span>
                  <input formControlName="focusCost" type="number" min="0" />
                </label>

                <label class="compact-field">
                  <span>Damage formula</span>
                  <input formControlName="damageFormula" type="text" placeholder="2d6 + 3" />
                </label>

                <label class="compact-field">
                  <span>Damage breakdown</span>
                  <input formControlName="damageBreakdown" type="text" placeholder="5 + 3" />
                </label>

                <label class="compact-field logger-details-span">
                  <span>Log note</span>
                  <textarea formControlName="note" rows="3" placeholder="Short narration or rider effect"></textarea>
                </label>

                @if (canSaveStrikePreset()) {
                  <div class="logger-details-span">
                    <button type="button" class="button-outline micro-button" (click)="saveStrikePreset.emit()">
                      Save strike preset for {{ participant.name }}
                    </button>
                  </div>
                }

                <div class="condition-manager logger-details-span">
                  <label class="compact-field">
                    <span>Add condition</span>
                    <input [formControl]="conditionForm().controls.conditionName" type="text" placeholder="Dazed, Prone, Marked..." />
                  </label>
                  <div class="button-row">
                    <button type="button" class="button-outline micro-button" (click)="addCondition.emit()">Add condition</button>
                  </div>
                  <div class="condition-quick-chips">
                    @for (condition of commonConditions(); track condition) {
                      <button type="button" class="button-outline micro-button" (click)="conditionForm().patchValue({ conditionName: condition })">
                        {{ condition }}
                      </button>
                    }
                  </div>
                  @if (participant.conditions.length) {
                    <div class="condition-quick-chips">
                      @for (condition of participant.conditions; track condition) {
                        <button type="button" class="button-outline micro-button" (click)="removeCondition.emit(condition)">
                          Remove {{ condition }}
                        </button>
                      }
                    </div>
                  }
                </div>
              </div>
            }
          </section>
        </form>
      } @else {
        <article class="empty-card">Select a combatant from the phase rail or battle overview to open the strike logger.</article>
      }
    </section>
  `,
})
export class CombatResolutionBoardComponent {
  readonly phaseLabel = input('');
  readonly selectedParticipant = input<CombatParticipantState | null>(null);
  readonly selectedTurn = input<CombatTurn | null>(null);
  readonly selectedParticipantState = input<CombatRoundParticipantState | null>(null);
  readonly selectedTarget = input<CombatParticipantState | null>(null);
  readonly supportText = input.required<ResolutionSupportText>();
  readonly resolutionMode = input.required<ResolutionMode>();
  readonly resolutionModes = input.required<readonly ResolutionModeOption[]>();
  readonly actionForm = input.required<CombatActionForm>();
  readonly conditionForm = input.required<CombatConditionForm>();
  readonly actionChoiceGroups = input.required<readonly ResolutionActionGroup[]>();
  readonly selectedActionChoiceId = input('');
  readonly loggerTargets = input.required<readonly ResolutionTargetChip[]>();
  readonly selectedWarnings = input.required<readonly string[]>();
  readonly quickD20Values = input.required<readonly number[]>();
  readonly quickCountValues = input.required<readonly number[]>();
  readonly resultChips = input.required<readonly ResultChip[]>();
  readonly commonConditions = input.required<readonly string[]>();
  readonly currentActionRequiresTarget = input(false);
  readonly currentActionRequiresRoll = input(false);
  readonly currentActionSupportsDamage = input(false);
  readonly showTargetStripForAction = input(false);
  readonly showRollFieldsForAction = input(false);
  readonly showDamageFieldForAction = input(false);
  readonly canCommitSelectedParticipant = input(false);
  readonly commitLabel = input('Commit');
  readonly canSubmitAction = input(false);
  readonly canSpendReaction = input(false);
  readonly canCompleteTurn = input(false);
  readonly canSelectNextTurn = input(false);
  readonly nextTurnLabel = input('Next turn');
  readonly submitBlockedReason = input('');
  readonly preferNextTurn = input(false);
  readonly canSaveStrikePreset = input(false);
  readonly logButtonLabel = input('Log action');
  readonly showEnemySheetButton = input(false);

  readonly resolutionModeChange = output<ResolutionMode>();
  readonly targetSelect = output<string>();
  readonly clearTarget = output<void>();
  readonly selectRawD20 = output<number>();
  readonly clearRawD20 = output<void>();
  readonly selectHitResult = output<HitResult>();
  readonly selectOpportunityCount = output<number>();
  readonly selectComplicationCount = output<number>();
  readonly submitAction = output<void>();
  readonly spendReaction = output<void>();
  readonly selectNextTurn = output<void>();
  readonly completeTurn = output<void>();
  readonly commitTurn = output<void>();
  readonly saveStrikePreset = output<void>();
  readonly addCondition = output<void>();
  readonly removeCondition = output<string>();
  readonly openEnemySheet = output<void>();
  readonly actionChoiceSelect = output<string>();

  readonly detailsOpen = signal(false);
  readonly participantTone = computed(() => {
    const side = this.selectedParticipant()?.side;
    return side === 'enemy' || side === 'npc' ? 'ruby' : 'sapphire';
  });
  readonly showTargetStrip = computed(() => this.showTargetStripForAction());
  readonly showRollFields = computed(() => this.showRollFieldsForAction());
  readonly showDamageField = computed(() => this.showDamageFieldForAction());

  turnSummaryLabel(): string {
    const turn = this.selectedTurn();
    if (!turn) {
      return this.canCommitSelectedParticipant() ? 'Awaiting commit' : 'No turn open';
    }
    return `${turn.actionsUsed}/${turn.actionsAvailable} actions`;
  }

  turnSummaryNote(): string {
    const turn = this.selectedTurn();
    if (turn?.status === 'open') {
      return `${turn.turnType} turn active`;
    }
    if (turn?.status === 'complete') {
      return 'Turn complete';
    }
    return this.canCommitSelectedParticipant() ? 'Commit to start this phase' : 'Reaction-only state';
  }

  detailsSummaryLabel(): string {
    if (this.detailsOpen()) {
      return 'Advanced fields open';
    }
    return 'Preset, notes, formulas, and conditions';
  }

  setResolutionMode(mode: ResolutionMode): void {
    this.detailsOpen.set(false);
    this.resolutionModeChange.emit(mode);
  }

  toggleDetails(): void {
    this.detailsOpen.set(!this.detailsOpen());
  }
}
