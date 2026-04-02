import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CombatParticipantState, CombatTurn } from '@shared/domain';
import { RosharIconComponent } from '../../shared/roshar-icon.component';
import { CombatParticipantTone } from './combat-tracker.types';

@Component({
  selector: 'app-combat-participant-row',
  imports: [CommonModule, RosharIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="battle-row"
      [class.selected-actor]="isActor()"
      [class.selected-target]="isTarget()"
      [class.turn-open]="turnStatus() === 'open'"
      [class.turn-complete]="turnStatus() === 'complete'">
      <button type="button" class="battle-row-main" (click)="selectParticipant.emit()">
        <div class="battle-row-identity">
          <strong class="event-line">
            <app-roshar-icon key="sessions" [label]="participant().name" [tone]="tone()" [size]="15" />
            {{ participant().name }}
          </strong>
          <small>{{ statusLabel() }}</small>
        </div>

        <div class="battle-row-status">
          <span class="tag-chip">
            <app-roshar-icon key="reaction" label="Reaction" [tone]="reactionTone()" [size]="12" />
            {{ reactionLabel() }}
          </span>
          @if (isActor()) {
            <span class="tag-chip emphasis-pill">Actor</span>
          }
          @if (isTarget()) {
            <span class="tag-chip">Target</span>
          }
        </div>

        <div class="battle-row-resources">
          <div class="battle-row-meter">
            <div class="battle-row-meter-copy">
              <span>HP</span>
              <strong>{{ healthLabel() }}</strong>
            </div>
            <div class="resource-meter-track compact-track">
              <span class="resource-meter-fill ruby-fill" [style.width.%]="healthPercent()"></span>
            </div>
          </div>

          <div class="battle-row-meter battle-row-meter--focus">
            <div class="battle-row-meter-copy">
              <span>Focus</span>
              <strong>{{ focusLabel() }}</strong>
            </div>
            <div class="resource-meter-track compact-track">
              <span class="resource-meter-fill topaz-fill" [style.width.%]="focusPercent()"></span>
            </div>
          </div>
        </div>
      </button>

      <div class="battle-row-actions">
        <button type="button" class="button-outline micro-button" (click)="onAdjustHealth($event, -1)">-1 HP</button>
        <button type="button" class="button-outline micro-button" (click)="onAdjustHealth($event, 1)">+1 HP</button>
        <button type="button" class="button-outline micro-button" (click)="onAdjustFocus($event, -1)">-1 F</button>
      </div>
    </article>
  `,
})
export class CombatParticipantRowComponent {
  readonly participant = input.required<CombatParticipantState>();
  readonly tone = input.required<CombatParticipantTone>();
  readonly statusLabel = input.required<string>();
  readonly reactionLabel = input.required<string>();
  readonly reactionTone = input.required<'emerald' | 'ruby'>();
  readonly turnStatus = input.required<CombatTurn['status'] | 'uncommitted'>();
  readonly isActor = input(false);
  readonly isTarget = input(false);

  readonly selectParticipant = output<void>();
  readonly adjustHealth = output<number>();
  readonly adjustFocus = output<number>();

  readonly healthPercent = computed(() => this.resourcePercent(this.participant().currentHealth, this.participant().maxHealth));
  readonly focusPercent = computed(() => this.resourcePercent(this.participant().currentFocus, this.participant().maxFocus));
  readonly healthLabel = computed(() => this.resourceLabel(this.participant().currentHealth, this.participant().maxHealth));
  readonly focusLabel = computed(() => this.resourceLabel(this.participant().currentFocus, this.participant().maxFocus));

  onAdjustHealth(event: Event, delta: number): void {
    event.stopPropagation();
    this.adjustHealth.emit(delta);
  }

  onAdjustFocus(event: Event, delta: number): void {
    event.stopPropagation();
    this.adjustFocus.emit(delta);
  }

  private resourcePercent(current: number | undefined, max: number | undefined): number {
    if (current === undefined) {
      return 0;
    }
    const maxValue = max ?? current;
    if (maxValue <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(100, (current / maxValue) * 100));
  }

  private resourceLabel(current: number | undefined, max: number | undefined): string {
    if (current === undefined) {
      return '-';
    }
    return max !== undefined ? `${current}/${max}` : `${current}`;
  }
}
