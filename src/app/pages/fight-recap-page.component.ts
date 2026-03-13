import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AppStoreService } from '../core/app-store.service';
import { ScoreboardComponent } from '../shared/scoreboard.component';
import { TimelineComponent } from '../shared/timeline.component';

@Component({
  selector: 'app-fight-recap-page',
  imports: [CommonModule, RouterLink, TimelineComponent, ScoreboardComponent],
  template: `
    @if (session(); as session) {
      @if (summary(); as summary) {
        <section class="page-header">
          <div>
            <p class="eyebrow">Fight Recap</p>
            <h1>{{ summary.fight.name }}</h1>
            <p>{{ session.sessionName }} • {{ summary.timeline.length }} tracked moments</p>
          </div>
          <div class="button-row">
            <a [routerLink]="['/sessions', session.id, 'fights', summary.fight.id]">Back to tracker</a>
          </div>
        </section>

        <app-timeline [events]="summary.timeline" [combatants]="summary.fight.combatants" title="Fight timeline" />
        <app-scoreboard [party]="summary.party" [enemies]="summary.enemies" />
      }
    }
  `,
})
export class FightRecapPageComponent {
  readonly store = inject(AppStoreService);
  private readonly route = inject(ActivatedRoute);

  readonly sessionId = toSignal(this.route.paramMap.pipe(map((params) => params.get('sessionId'))), {
    initialValue: this.route.snapshot.paramMap.get('sessionId'),
  });
  readonly fightId = toSignal(this.route.paramMap.pipe(map((params) => params.get('fightId'))), {
    initialValue: this.route.snapshot.paramMap.get('fightId'),
  });
  readonly session = computed(() => this.store.sessionById(this.sessionId()));
  readonly summary = computed(() => this.store.fightSummary(this.sessionId(), this.fightId()));
}
