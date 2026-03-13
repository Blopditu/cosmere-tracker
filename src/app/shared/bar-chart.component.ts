import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { AnalyticsPoint } from '../core/models';

@Component({
  selector: 'app-bar-chart',
  imports: [CommonModule, DecimalPipe],
  template: `
    <div class="chart">
      @for (point of sortedPoints(); track point.key) {
        <div class="chart-row">
          <div class="chart-label">
            <span class="swatch" [style.background]="point.side === 'party' ? '#22c55e' : '#f97316'"></span>
            <span>{{ point.label }}</span>
          </div>
          <div class="chart-bar-wrap">
            <svg class="chart-svg" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
              <rect
                x="0"
                y="0"
                [attr.width]="barWidth(point.value)"
                height="10"
                rx="4"
                [attr.fill]="point.side === 'party' ? '#22c55e' : '#f97316'"
              />
            </svg>
            <span class="chart-value">{{ point.value | number: '1.0-1' }}</span>
          </div>
        </div>
      }
    </div>
  `,
})
export class BarChartComponent {
  readonly points = input.required<AnalyticsPoint[]>();
  readonly sortedPoints = computed(() =>
    [...this.points()].sort((left, right) => right.value - left.value).slice(0, 12),
  );
  readonly max = computed(() => Math.max(...this.sortedPoints().map((point) => point.value), 1));

  barWidth(value: number): number {
    return (value / this.max()) * 100;
  }
}
