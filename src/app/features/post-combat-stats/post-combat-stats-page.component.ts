import { CommonModule, JsonPipe } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ActionEvent, CombatSummaryRow, ConditionEvent, DamageEvent, FocusEvent, HealthEvent } from '@shared/domain';
import { RosharIconComponent } from '../../shared/roshar-icon.component';
import { actionIcon, createIcon, resultIcon } from '../../shared/roshar-icons';
import { CombatStore } from '../combat-tracker/combat.store';

@Component({
  selector: 'app-post-combat-stats-page',
  imports: [CommonModule, JsonPipe, RosharIconComponent],
  template: `
    @if (store.summary()) {
      <section class="page-header war-report-header card engraved-panel">
        <div class="route-heading">
          <p class="eyebrow">Post-combat scoreboard</p>
          <h2>{{ store.summary()!.combat.title }}</h2>
          <p>Review the clash through damage, accuracy, focus pressure, and support play without losing the full chronicle.</p>
        </div>
        <div class="war-report-leads">
          <article class="route-stat ruby">
              <app-roshar-icon key="damage" label="Biggest hit" tone="ruby" [size]="18" />
              <span class="eyebrow">Biggest hit</span>
              <strong>{{ topBiggestHit()?.biggestHit || 0 }}</strong>
            </article>
            <article class="route-stat emerald">
              <app-roshar-icon key="support" label="Most support" tone="emerald" [size]="18" />
              <span class="eyebrow">Most support</span>
              <strong>{{ topSupport()?.name || 'None' }}</strong>
            </article>
            <article class="route-stat sapphire">
              <app-roshar-icon key="crit" label="Most accurate" tone="sapphire" [size]="18" />
              <span class="eyebrow">Most accurate</span>
              <strong>{{ topAccuracy()?.name || 'None' }}</strong>
            </article>
        </div>
      </section>

      <section class="stats-grid summary-highlights war-report-highlights">
        <article class="stat-card gemstone-stat ruby">
          <app-roshar-icon key="damage" label="Top damage" tone="ruby" [size]="20" />
          <span class="stat-label">Top damage</span>
          <strong>{{ topDamage()?.name || 'None' }}</strong>
          <small>{{ topDamage()?.totalDamageDealt || 0 }} dealt</small>
        </article>
        <article class="stat-card gemstone-stat sapphire">
          <app-roshar-icon key="crit" label="Most accurate" tone="sapphire" [size]="20" />
          <span class="stat-label">Most accurate</span>
          <strong>{{ topAccuracy()?.name || 'None' }}</strong>
          <small>{{ accuracyRateLabel() }} hit rate</small>
        </article>
        <article class="stat-card gemstone-stat emerald">
          <app-roshar-icon key="support" label="Most support" tone="emerald" [size]="20" />
          <span class="stat-label">Most support</span>
          <strong>{{ topSupport()?.name || 'None' }}</strong>
          <small>{{ topSupport()?.supportActionsUsed || 0 }} support actions</small>
        </article>
        <article class="stat-card gemstone-stat topaz">
          <app-roshar-icon key="focus" label="Focus pressure" tone="topaz" [size]="20" />
          <span class="stat-label">Focus pressure</span>
          <strong>{{ topFocus()?.name || 'None' }}</strong>
          <small>{{ topFocus()?.focusSpent || 0 }} focus spent</small>
        </article>
      </section>

      <div class="layout-columns war-report-columns">
        <section class="card engraved-panel">
          <div class="card-header">
            <div class="section-heading">
              <app-roshar-icon key="support" label="Combat awards" tone="emerald" [size]="18" />
              <h3>Combat awards</h3>
            </div>
            <span class="pill">{{ store.summary()!.rows.length }} combatants</span>
          </div>
          <div class="button-row">
            <span class="tag-chip">Top damage: {{ topDamage()?.name || 'None' }}</span>
            <span class="tag-chip">Top tank: {{ topDamageTaken()?.name || 'None' }}</span>
            <span class="tag-chip">Best support: {{ topSupport()?.name || 'None' }}</span>
            <span class="tag-chip">Most accurate: {{ topAccuracy()?.name || 'None' }}</span>
          </div>
        </section>

        <section class="card engraved-panel chronicle-feed war-report-log" data-tour="combat-summary-log">
          <div class="card-header">
            <div>
              <p class="eyebrow">Battle chronicle</p>
              <h3>Full combat log</h3>
            </div>
            <span class="pill">{{ store.summary()!.fullLog.length }}</span>
          </div>
          <div class="list-stack">
            @for (item of store.summary()!.fullLog; track item.id) {
              <article class="timeline-item chronicle-entry">
                <strong class="event-line">
                  <app-roshar-icon [key]="logDescriptor(item).key" [label]="logDescriptor(item).label" [tone]="logDescriptor(item).tone || 'muted'" [size]="16" />
                  {{ item.timestamp | date: 'shortTime' }}
                </strong>
                <p>{{ describeLog(item) }}</p>
                <small>{{ item | json }}</small>
              </article>
            }
          </div>
        </section>
      </div>

      <div class="layout-columns war-report-graphs">
        <section class="card engraved-panel graph-card">
          <div class="card-header">
            <div>
              <p class="eyebrow">Damage graph</p>
              <h3>Damage dealt</h3>
            </div>
          </div>
          <div class="bar-graph-list">
            @for (row of damageRows(); track row.participantId) {
              <article class="bar-graph-row">
                <div class="bar-graph-label event-line">
                  <app-roshar-icon key="sessions" [label]="row.name" [tone]="row.side === 'enemy' || row.side === 'npc' ? 'ruby' : 'sapphire'" [size]="15" />
                  <span>{{ row.name }}</span>
                </div>
                <div class="bar-graph-track">
                  <span class="bar-graph-fill ruby-fill" [style.width.%]="damageWidth(row.totalDamageDealt)"></span>
                </div>
                <strong>{{ row.totalDamageDealt }}</strong>
              </article>
            }
          </div>
        </section>

        <section class="card engraved-panel graph-card">
          <div class="card-header">
            <div>
              <p class="eyebrow">D20 graph</p>
              <h3>Average raw d20</h3>
            </div>
          </div>
          <div class="bar-graph-list">
            @for (row of rollRows(); track row.participantId) {
              <article class="bar-graph-row">
                <div class="bar-graph-label event-line">
                  <app-roshar-icon key="rolls" [label]="row.name" [tone]="row.side === 'enemy' || row.side === 'npc' ? 'ruby' : 'sapphire'" [size]="15" />
                  <span>{{ row.name }}</span>
                </div>
                <div class="bar-graph-track">
                  <span class="bar-graph-fill sapphire-fill" [style.width.%]="d20Width(row.averageRawD20)"></span>
                </div>
                <strong>{{ row.averageRawD20 | number: '1.1-1' }}</strong>
              </article>
            }
          </div>
        </section>
      </div>

      <section class="card engraved-panel war-report-table" data-tour="combat-summary-table">
        <div class="card-header">
          <div>
            <p class="eyebrow">Engagement board</p>
            <h3>Scoreboard</h3>
          </div>
          <span class="pill">{{ store.summary()!.rows.length }} rows</span>
        </div>
        <div class="table-wrap">
          <table class="summary-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Damage dealt</th>
                <th>Damage taken</th>
                <th>Avg d20</th>
                <th>Hit rate</th>
                <th>Graze</th>
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
                  <td class="event-line">
                    <app-roshar-icon key="sessions" [label]="row.name" [tone]="row.side === 'enemy' || row.side === 'npc' ? 'ruby' : 'sapphire'" [size]="15" />
                    {{ row.name }}
                  </td>
                  <td>{{ row.totalDamageDealt }}</td>
                  <td>{{ row.totalDamageTaken }}</td>
                  <td>{{ row.averageRawD20 | number: '1.1-1' }}</td>
                  <td>{{ row.hitRate | percent: '1.0-0' }}</td>
                  <td>{{ row.grazeCount }}</td>
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

  topDamage(): CombatSummaryRow | null {
    return [...(this.store.summary()?.rows ?? [])].sort((left, right) => right.totalDamageDealt - left.totalDamageDealt)[0] ?? null;
  }

  topAccuracy(): CombatSummaryRow | null {
    return [...(this.store.summary()?.rows ?? [])].sort((left, right) => right.hitRate - left.hitRate)[0] ?? null;
  }

  topSupport(): CombatSummaryRow | null {
    return [...(this.store.summary()?.rows ?? [])].sort(
      (left, right) => right.supportActionsUsed - left.supportActionsUsed,
    )[0] ?? null;
  }

  topFocus(): CombatSummaryRow | null {
    return [...(this.store.summary()?.rows ?? [])].sort((left, right) => right.focusSpent - left.focusSpent)[0] ?? null;
  }

  topDamageTaken(): CombatSummaryRow | null {
    return [...(this.store.summary()?.rows ?? [])].sort((left, right) => right.totalDamageTaken - left.totalDamageTaken)[0] ?? null;
  }

  topBiggestHit(): CombatSummaryRow | null {
    return [...(this.store.summary()?.rows ?? [])].sort((left, right) => right.biggestHit - left.biggestHit)[0] ?? null;
  }

  damageRows(): CombatSummaryRow[] {
    return [...(this.store.summary()?.rows ?? [])].sort((left, right) => right.totalDamageDealt - left.totalDamageDealt);
  }

  rollRows(): CombatSummaryRow[] {
    return [...(this.store.summary()?.rows ?? [])].sort((left, right) => right.averageRawD20 - left.averageRawD20);
  }

  accuracyRateLabel(): string {
    const row = this.topAccuracy();
    return `${Math.round((row?.hitRate ?? 0) * 100)}%`;
  }

  damageWidth(value: number): number {
    const max = Math.max(1, ...this.damageRows().map((row) => row.totalDamageDealt));
    return (value / max) * 100;
  }

  d20Width(value: number): number {
    return (Math.max(0, value) / 20) * 100;
  }

  logDescriptor(item: ActionEvent | DamageEvent | FocusEvent | HealthEvent | ConditionEvent) {
    if ('actionType' in item) {
      return actionIcon(item.actionType, item.actionType);
    }
    if ('amount' in item) {
      return createIcon('damage', 'Damage event', 'ruby');
    }
    if ('delta' in item) {
      if ('sourceParticipantId' in item) {
        return createIcon('health', 'Health event', item.delta > 0 ? 'emerald' : 'ruby');
      }
      return createIcon('focus', 'Focus event', item.delta > 0 ? 'emerald' : 'topaz');
    }
    return resultIcon(item.operation === 'add' ? 'support' : 'neutral');
  }

  describeLog(item: ActionEvent | DamageEvent | FocusEvent | HealthEvent | ConditionEvent): string {
    if ('actionType' in item) {
      const targetText = item.targetIds.length ? ` vs ${item.targetIds.length} target${item.targetIds.length > 1 ? 's' : ''}` : '';
      const resultText = item.hitResult ? `, ${item.hitResult}` : '';
      return `${item.actionType}${targetText}${resultText}`;
    }

    if ('amount' in item) {
      return `${item.amount} damage applied to ${item.targetParticipantId}`;
    }

    if ('delta' in item) {
      const polarity = item.delta > 0 ? '+' : '';
      if ('sourceParticipantId' in item) {
        return `${polarity}${item.delta} health on ${item.participantId} for ${item.reason}`;
      }
      return `${polarity}${item.delta} focus on ${item.participantId} for ${item.reason}`;
    }

    return `${item.operation} ${item.conditionName} on ${item.participantId}`;
  }
}
