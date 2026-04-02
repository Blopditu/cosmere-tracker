import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-sheet-number-stepper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sheet-number-stepper" [class.compact]="compact()">
      <button
        type="button"
        class="sheet-number-stepper__button"
        [disabled]="cannotDecrease()"
        [attr.aria-label]="decrementLabel()"
        (click)="changeBy(-step())">
        <span>-</span>
      </button>
      <div class="sheet-number-stepper__value">
        <strong>{{ value() }}</strong>
      </div>
      <button
        type="button"
        class="sheet-number-stepper__button"
        [disabled]="cannotIncrease()"
        [attr.aria-label]="incrementLabel()"
        (click)="changeBy(step())">
        <span>+</span>
      </button>
    </div>
  `,
})
export class SheetNumberStepperComponent {
  readonly value = input.required<number>();
  readonly step = input(1);
  readonly minimum = input<number | undefined>(undefined);
  readonly maximum = input<number | undefined>(undefined);
  readonly compact = input(false);
  readonly decrementLabel = input('Decrease value');
  readonly incrementLabel = input('Increase value');

  readonly valueChange = output<number>();

  readonly cannotDecrease = computed(
    () => this.minimum() !== undefined && this.value() - this.step() < this.minimum()!,
  );
  readonly cannotIncrease = computed(
    () => this.maximum() !== undefined && this.value() + this.step() > this.maximum()!,
  );

  changeBy(delta: number): void {
    const next = this.value() + delta;
    if (this.minimum() !== undefined && next < this.minimum()!) {
      return;
    }
    if (this.maximum() !== undefined && next > this.maximum()!) {
      return;
    }
    this.valueChange.emit(next);
  }
}
