import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AppStoreService } from '../core/app-store.service';
import { ScoreboardComponent } from '../shared/scoreboard.component';

@Component({
  selector: 'app-session-recap-page',
  imports: [CommonModule, RouterLink, ScoreboardComponent],
  template: `
    @if (summary(); as summary) {
      <section class="page-header">
        <div>
          <p class="eyebrow">Session Recap</p>
          <h1>{{ summary.session.sessionName }}</h1>
          <p>{{ summary.session.campaignName }} • {{ summary.fights.length }} fights</p>
        </div>
        <div class="button-row">
          <a [routerLink]="['/sessions', summary.session.id]">Back to session</a>
        </div>
      </section>

      <section class="card">
        <div class="card-header">
          <h2>Fight breakdown</h2>
          <span class="pill">{{ summary.fights.length }}</span>
        </div>
        <div class="list-stack">
          @for (fightSummary of summary.fights; track fightSummary.fight.id) {
            <article class="list-card">
              <div>
                <h3>{{ fightSummary.fight.name }}</h3>
                <p>{{ fightSummary.timeline.length }} events • {{ fightSummary.enemies.length }} enemies faced</p>
              </div>
              <div class="button-row">
                <a [routerLink]="['/sessions', summary.session.id, 'fights', fightSummary.fight.id, 'recap']">View fight recap</a>
              </div>
            </article>
          }
        </div>
      </section>

      <app-scoreboard
        [party]="summary.party"
        [enemies]="summary.enemies"
        partyLabel="Session party totals"
        enemyLabel="Session enemy totals"
      />
    }
  `,
})
export class SessionRecapPageComponent {
  readonly store = inject(AppStoreService);
  private readonly route = inject(ActivatedRoute);

  readonly sessionId = toSignal(this.route.paramMap.pipe(map((params) => params.get('sessionId'))), {
    initialValue: this.route.snapshot.paramMap.get('sessionId'),
  });
  readonly summary = computed(() => this.store.sessionSummary(this.sessionId()));
}
