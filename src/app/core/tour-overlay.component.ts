import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject } from '@angular/core';
import { fromEvent, merge } from 'rxjs';
import { TourService } from './tour.service';

@Component({
  selector: 'app-tour-overlay',
  imports: [CommonModule],
  template: `
    @if (tour.isOpen() && tour.currentStep() && tour.spotlightRect()) {
      <button class="tour-backdrop" type="button" aria-label="Close guided tour" (click)="tour.close()"></button>
      <div
        class="tour-spotlight"
        [style.top.px]="tour.spotlightRect()!.top"
        [style.left.px]="tour.spotlightRect()!.left"
        [style.width.px]="tour.spotlightRect()!.width"
        [style.height.px]="tour.spotlightRect()!.height"
      ></div>

      <aside class="tour-card" [style.top.px]="tooltipTop()" [style.left.px]="tooltipLeft()" (click)="$event.stopPropagation()">
        <div class="tour-card-header">
          <span class="pill">{{ tour.stepLabel() }}</span>
          <button type="button" class="tour-close" (click)="tour.close()">Close</button>
        </div>
        <h3>{{ tour.currentStep()!.title }}</h3>
        <p>{{ tour.currentStep()!.description }}</p>
        <div class="button-row">
          <button type="button" class="button-outline" [disabled]="tour.activeIndex() === 0" (click)="tour.previous()">Back</button>
          <button type="button" (click)="tour.next()">
            {{ tour.activeIndex() === tour.steps().length - 1 ? 'Finish' : 'Next' }}
          </button>
        </div>
      </aside>
    }
  `,
})
export class TourOverlayComponent {
  readonly tour = inject(TourService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tooltipTop = computed(() => {
    const rect = this.tour.spotlightRect();
    const step = this.tour.currentStep();
    if (!rect || !step) {
      return 24;
    }
    if (step.placement === 'top') {
      return Math.max(16, rect.top - 220);
    }
    return Math.min(window.innerHeight - 220, rect.top + rect.height + 18);
  });

  readonly tooltipLeft = computed(() => {
    const rect = this.tour.spotlightRect();
    const step = this.tour.currentStep();
    const cardWidth = 360;
    if (!rect || !step) {
      return 24;
    }
    if (step.placement === 'right') {
      return Math.min(window.innerWidth - cardWidth - 24, rect.left + rect.width + 18);
    }
    if (step.placement === 'left') {
      return Math.max(24, rect.left - cardWidth - 18);
    }
    return Math.min(window.innerWidth - cardWidth - 24, Math.max(24, rect.left));
  });

  constructor() {
    const sub = merge(fromEvent(window, 'resize'), fromEvent(window, 'scroll')).subscribe(() => this.tour.refresh());
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }
}
