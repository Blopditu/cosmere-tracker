import { CommonModule, JsonPipe } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CombatStore } from '../combat-tracker/combat.store';

@Component({
  selector: 'app-post-combat-stats-page',
  imports: [CommonModule, JsonPipe],
  template: `
    @if (store.summary()) {
      <section class="page-header">
        <div>
          <p class="eyebrow">Post-combat scoreboard</p>
          <h2>{{ store.summary()!.combat.title }}</h2>
          <p>Rewarding recap with the full combat log and role-based contribution stats.</p>
        </div>
      </section>

      <section class="card">
        <div class="card-header">
          <h3>Scoreboard</h3>
          <span class="pill">{{ store.summary()!.rows.length }} rows</span>
        </div>
        <div class="table-wrap">
          <table class="summary-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Damage dealt</th>
                <th>Damage taken</th>
                <th>Hit rate</th>
                <th>Crits</th>
                <th>Nat 20</th>
                <th>Nat 1</th>
                <th>Focus spent</th>
                <th>Support</th>
              </tr>
            </thead>
            <tbody>
              @for (row of store.summary()!.rows; track row.participantId) {
                <tr>
                  <td>{{ row.name }}</td>
                  <td>{{ row.totalDamageDealt }}</td>
                  <td>{{ row.totalDamageTaken }}</td>
                  <td>{{ row.hitRate | percent: '1.0-0' }}</td>
                  <td>{{ row.critCount }}</td>
                  <td>{{ row.nat20Count }}</td>
                  <td>{{ row.nat1Count }}</td>
                  <td>{{ row.focusSpent }}</td>
                  <td>{{ row.supportActionsUsed }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="card-header">
          <h3>Full combat log</h3>
          <span class="pill">{{ store.summary()!.fullLog.length }}</span>
        </div>
        <div class="list-stack">
          @for (item of store.summary()!.fullLog; track item.id) {
            <article class="timeline-item">
              <strong>{{ item.timestamp | date: 'shortTime' }}</strong>
              <p>{{ item | json }}</p>
            </article>
          }
        </div>
      </section>
    } @else {
      <section class="card empty-card">Loading post-combat summary...</section>
    }
  `,
})
export class PostCombatStatsPageComponent {
  readonly store = inject(CombatStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    const sub = this.route.paramMap.subscribe((params) => {
      const combatId = params.get('combatId');
      if (combatId) {
        void this.store.loadSummary(combatId);
      }
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }
}
