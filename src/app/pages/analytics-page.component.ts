import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AppStoreService } from '../core/app-store.service';
import { rollUpActorSummariesByName, summarizeSession } from '../core/combat-summary';
import { ActorSummary, AnalyticsPoint } from '../core/models';
import { BarChartComponent } from '../shared/bar-chart.component';

@Component({
  selector: 'app-analytics-page',
  imports: [CommonModule, ReactiveFormsModule, BarChartComponent],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Analytics</p>
        <h1>Combat performance trends</h1>
        <p>Slice by session, fight, side, actor, and support tag without storing separate summary objects.</p>
      </div>
    </section>

    <section class="card">
      <div class="card-header">
        <h2>Filters</h2>
        <span class="pill">Live</span>
      </div>
      <form class="form-grid" [formGroup]="filters">
        <label>
          <span>Session</span>
          <select formControlName="sessionId">
            <option value="">All sessions</option>
            @for (session of store.sessions(); track session.id) {
              <option [value]="session.id">{{ session.sessionName }}</option>
            }
          </select>
        </label>
        <label>
          <span>Fight</span>
          <select formControlName="fightId">
            <option value="">All fights</option>
            @for (fight of availableFights(); track fight.id) {
              <option [value]="fight.id">{{ fight.name }}</option>
            }
          </select>
        </label>
        <label>
          <span>Side</span>
          <select formControlName="side">
            <option value="all">All</option>
            <option value="party">Party</option>
            <option value="enemy">Enemy</option>
          </select>
        </label>
        <label>
          <span>Actor search</span>
          <input formControlName="actorQuery" type="text" placeholder="Kaladin, cultist, etc." />
        </label>
        <label>
          <span>Support tag</span>
          <select formControlName="tag">
            <option value="">All support</option>
            @for (tag of store.supportTags(); track tag) {
              <option [value]="tag">{{ tag }}</option>
            }
          </select>
        </label>
      </form>
    </section>

    <div class="grid-two analytics-grid">
      <section class="card">
        <div class="card-header"><h2>Damage dealt</h2></div>
        <app-bar-chart [points]="damageDealtPoints()" />
      </section>
      <section class="card">
        <div class="card-header"><h2>Damage taken</h2></div>
        <app-bar-chart [points]="damageTakenPoints()" />
      </section>
      <section class="card">
        <div class="card-header"><h2>Kills</h2></div>
        <app-bar-chart [points]="killsPoints()" />
      </section>
      <section class="card">
        <div class="card-header"><h2>Support actions</h2></div>
        <app-bar-chart [points]="supportPoints()" />
      </section>
      <section class="card">
        <div class="card-header"><h2>Roll volume</h2></div>
        <app-bar-chart [points]="rollPoints()" />
      </section>
      <section class="card">
        <div class="card-header"><h2>Accuracy %</h2></div>
        <app-bar-chart [points]="accuracyPoints()" />
      </section>
      <section class="card">
        <div class="card-header"><h2>Crit count</h2></div>
        <app-bar-chart [points]="critPoints()" />
      </section>
    </div>
  `,
})
export class AnalyticsPageComponent {
  readonly store = inject(AppStoreService);
  private readonly fb = inject(FormBuilder);

  readonly filters = this.fb.nonNullable.group({
    sessionId: [''],
    fightId: [''],
    side: ['all'],
    actorQuery: [''],
    tag: [''],
  });

  readonly availableFights = computed(() => {
    const sessionId = this.filters.controls.sessionId.value;
    return this.store.sessionById(sessionId)?.fights ?? [];
  });

  readonly summaries = computed(() => {
    const sessionId = this.filters.controls.sessionId.value;
    const fightId = this.filters.controls.fightId.value;
    const side = this.filters.controls.side.value;
    const actorQuery = this.filters.controls.actorQuery.value.trim().toLowerCase();
    const tag = this.filters.controls.tag.value;

    let summaries: ActorSummary[] = [];
    if (sessionId && fightId) {
      const fightSummary = this.store.fightSummary(sessionId, fightId);
      summaries = [...(fightSummary?.party ?? []), ...(fightSummary?.enemies ?? [])];
    } else if (sessionId) {
      const session = this.store.sessionById(sessionId);
      if (session) {
        const sessionSummary = summarizeSession(session);
        summaries = [...sessionSummary.party, ...sessionSummary.enemies];
      }
    } else {
      summaries = rollUpActorSummariesByName(
        this.store.sessions().flatMap((session) => {
          const sessionSummary = summarizeSession(session);
          return [...sessionSummary.party, ...sessionSummary.enemies];
        }),
      );
    }

    return summaries.filter((summary) => {
      if (side !== 'all' && summary.side !== side) {
        return false;
      }
      if (actorQuery && !summary.name.toLowerCase().includes(actorQuery)) {
        return false;
      }
      if (tag && (summary.tagCounts[tag] ?? 0) === 0) {
        return false;
      }
      return true;
    });
  });

  readonly damageDealtPoints = computed(() => this.points((summary) => summary.damageDealt));
  readonly damageTakenPoints = computed(() => this.points((summary) => summary.damageTaken));
  readonly killsPoints = computed(() => this.points((summary) => summary.kills));
  readonly supportPoints = computed(() => {
    const tag = this.filters.controls.tag.value;
    return this.points((summary) => (tag ? (summary.tagCounts[tag] ?? 0) : summary.supportActions));
  });
  readonly rollPoints = computed(() => this.points((summary) => summary.rollCount));
  readonly accuracyPoints = computed(() => this.points((summary) => Number((summary.accuracy * 100).toFixed(1))));
  readonly critPoints = computed(() => this.points((summary) => summary.critCount));

  constructor() {
    effect(() => {
      const fightId = this.filters.controls.fightId.value;
      if (fightId && !this.availableFights().some((fight) => fight.id === fightId)) {
        this.filters.patchValue({ fightId: '' }, { emitEvent: false });
      }
    });
  }

  private points(selector: (summary: ActorSummary) => number): AnalyticsPoint[] {
    return this.summaries().map((summary) => ({
      key: summary.actorId,
      label: summary.name,
      side: summary.side,
      value: selector(summary),
    }));
  }
}
