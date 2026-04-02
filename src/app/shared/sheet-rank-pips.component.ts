import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

function createPipValues(maximum: number): number[] {
  return Array.from({ length: maximum }, (_, index) => index + 1);
}

@Component({
  selector: 'app-sheet-rank-pips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sheet-rank-pips" role="group" [attr.aria-label]="label()">
      @for (pip of pipValues(); track pip) {
        <button
          type="button"
          class="sheet-rank-pip"
          [class.active]="pip <= value()"
          [attr.aria-label]="label() + ' rank ' + pip"
          (click)="selectPip(pip)">
          <span></span>
        </button>
      }
    </div>
  `,
})
export class SheetRankPipsComponent {
  readonly value = input(0);
  readonly maximum = input(5);
  readonly label = input('Skill rank');

  readonly valueChange = output<number>();
  readonly pipValues = computed(() => createPipValues(this.maximum()));

  selectPip(pip: number): void {
    const nextValue = this.value() === pip ? Math.max(0, pip - 1) : pip;
    this.valueChange.emit(nextValue);
  }
}
