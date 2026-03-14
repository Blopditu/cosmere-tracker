import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { RollOutcome } from '@shared/domain';
import { SessionStoreService } from '../../core/session-store.service';
import { RosharIconComponent } from '../../shared/roshar-icon.component';
import { resultIcon, rollCategoryIcon } from '../../shared/roshar-icons';
import { RollTrackerStore } from './roll-tracker.store';

@Component({
  selector: 'app-roll-tracker-page',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RosharIconComponent],
  template: `
    <section class="page-header roll-ledger-header card engraved-panel">
      <div class="route-heading">
        <p class="eyebrow">Global roll tracker</p>
        <h2>Session dice ledger</h2>
        <p>Capture every d20 in one place, whether it came from combat, exploration, recovery, or a quick ruling at the table.</p>
      </div>
      <div class="roll-ledger-summary">
        <article class="route-stat sapphire">
            <app-roshar-icon key="rolls" label="Rolls logged" tone="sapphire" [size]="18" />
            <span class="eyebrow">Rolls</span>
            <strong>{{ store.analytics()?.totalRolls || 0 }}</strong>
          </article>
          <article class="route-stat topaz">
            <app-roshar-icon key="chronicle" label="Average d20" tone="topaz" [size]="18" />
            <span class="eyebrow">Avg d20</span>
            <strong>{{ (store.analytics()?.averageRawD20 || 0) | number: '1.1-1' }}</strong>
          </article>
          <article class="route-stat ruby">
            <app-roshar-icon key="crit" label="Current total" tone="ruby" [size]="18" />
            <span class="eyebrow">Current total</span>
            <strong>{{ total() }}</strong>
          </article>
      </div>
    </section>

    <div class="layout-columns roll-ledger-columns">
      <section class="card engraved-panel roll-log-card" data-tour="roll-form">
        <div class="card-header">
          <div>
            <p class="eyebrow">Quick log</p>
            <h3>Log roll</h3>
          </div>
          <span class="pill">Total {{ total() }}</span>
        </div>
        <form class="form-grid compact-roll-form" [formGroup]="form" (ngSubmit)="submit()">
          <label>
            <span>Actor</span>
            <select formControlName="actorId">
              <option value="">Manual name</option>
              @for (member of partyMembers(); track member.id) {
                <option [value]="member.id">{{ member.name }}</option>
              }
            </select>
          </label>
          <label>
            <span>Actor name</span>
            <input formControlName="actorName" type="text" placeholder="Optional override" />
          </label>
          <label>
            <span>Target name</span>
            <input formControlName="targetName" type="text" placeholder="Enemy or obstacle" />
          </label>
          <label>
            <span>Category</span>
            <select formControlName="rollCategory">
              <option value="attack">Attack</option>
              <option value="skill">Skill</option>
              <option value="defense">Defense</option>
              <option value="recovery">Recovery</option>
              <option value="injury">Injury</option>
              <option value="generic">Generic</option>
            </select>
          </label>
          <label>
            <span>d20</span>
            <input formControlName="rawD20" type="number" min="1" max="20" />
          </label>
          <label>
            <span>Modifier</span>
            <input formControlName="modifier" type="number" />
          </label>
          <label>
            <span>Outcome</span>
            <select formControlName="outcome">
              <option value="neutral">Neutral</option>
              <option value="success">Success</option>
              <option value="graze">Graze</option>
              <option value="failure">Failure</option>
              <option value="criticalSuccess">Critical success</option>
              <option value="criticalFailure">Critical failure</option>
            </select>
          </label>
          <div class="full-width exact-d20-panel">
            <div class="section-heading">
              <app-roshar-icon key="rolls" label="Exact d20 result" tone="topaz" [size]="16" />
              <h3>Exact d20 result</h3>
            </div>
            <p>Type the raw result directly, or tap the quick grid for speed.</p>
            <div class="exact-d20-row compact-d20-grid">
              @for (value of quickD20Values; track value) {
                <button type="button" class="button-outline micro-button" [class.active]="form.controls.rawD20.value === value" [class.edge-roll]="value === 1 || value === 20" (click)="setRawD20(value)">
                  {{ value }}
                </button>
              }
            </div>
          </div>
          <div class="full-width advanced-toggle-row" data-tour="roll-advanced">
            <button type="button" class="button-outline micro-button" (click)="advancedOpen.set(!advancedOpen())">
              {{ advancedOpen() ? 'Hide advanced fields' : 'Show advanced fields' }}
            </button>
            <span class="tag-chip">Optional notes, advantage, and plot context</span>
          </div>
          @if (advancedOpen()) {
            <label>
              <span>Advantage note</span>
              <input formControlName="advantageNote" type="text" placeholder="advantage, disadvantage, plot die..." />
            </label>
            <label class="full-width">
              <span>Note</span>
              <textarea formControlName="note" rows="2"></textarea>
            </label>
          }
          <div class="button-row full-width">
            <button type="submit">Log roll</button>
          </div>
        </form>
      </section>

      <section class="card engraved-panel chronicle-feed roll-ledger-feed" data-tour="roll-history">
        <div class="card-header">
          <div>
            <p class="eyebrow">Dice chronicle</p>
            <h3>Recent roll history</h3>
          </div>
          <span class="pill">{{ store.rolls().length }}</span>
        </div>
        <div class="list-stack">
          @for (roll of store.rolls(); track roll.id) {
            <article class="timeline-item chronicle-entry">
              <strong class="event-line">
                <app-roshar-icon [key]="rollDescriptor(roll.rollCategory).key" [label]="rollDescriptor(roll.rollCategory).label" [tone]="rollDescriptor(roll.rollCategory).tone || 'muted'" [size]="16" />
                {{ roll.actorName || roll.actorId || 'Unknown' }}
              </strong>
              <p>{{ roll.rollCategory }} vs {{ roll.targetName || 'n/a' }} • {{ roll.total }} total</p>
              <small class="event-line">
                <app-roshar-icon [key]="outcomeDescriptor(roll.outcome).key" [label]="outcomeDescriptor(roll.outcome).label" [tone]="outcomeDescriptor(roll.outcome).tone || 'muted'" [size]="14" />
                {{ roll.timestamp | date: 'short' }} • {{ roll.outcome }}
              </small>
            </article>
          } @empty {
            <article class="empty-card">No rolls in the ledger yet. Log the first d20 to start the session chronicle.</article>
          }
        </div>
      </section>
    </div>

    <section class="card engraved-panel roll-analytics-panel" data-tour="roll-analytics">
      <div class="card-header">
        <div>
          <p class="eyebrow">Luck readout</p>
          <h3>Session analytics</h3>
        </div>
        <span class="pill">{{ store.analytics()?.totalRolls || 0 }} rolls</span>
      </div>
    </section>

    @if (store.analytics()) {
      <div class="layout-columns roll-analytics-columns">
        <div class="stats-grid summary-highlights">
          <article class="stat-card gemstone-stat sapphire">
            <span class="stat-label">Average raw d20</span>
            <strong>{{ store.analytics()!.averageRawD20 | number: '1.1-1' }}</strong>
          </article>
          <article class="stat-card gemstone-stat topaz">
            <span class="stat-label">Nat 20s</span>
            <strong>{{ store.analytics()!.nat20Count }}</strong>
          </article>
          <article class="stat-card gemstone-stat ruby">
            <span class="stat-label">Nat 1s</span>
            <strong>{{ store.analytics()!.nat1Count }}</strong>
          </article>
          <article class="stat-card gemstone-stat emerald">
            <span class="stat-label">Attack accuracy</span>
            <strong>{{ store.analytics()!.attackAccuracy | percent: '1.0-0' }}</strong>
          </article>
        </div>

        <div class="split-grid compact-summary-grid">
          <article class="inset-panel compact-summary-card">
            <div class="section-heading">
              <app-roshar-icon key="crit" label="Luck summary" tone="topaz" [size]="16" />
              <h3>Luck summary</h3>
            </div>
            <p>Session luck delta {{ store.analytics()!.luckDelta | number: '1.1-1' }} from expected d20 average.</p>
          </article>
          <article class="inset-panel compact-summary-card">
            <div class="section-heading">
              <app-roshar-icon key="sessions" label="Luck leader" tone="sapphire" [size]="16" />
              <h3>Highest average</h3>
            </div>
            <p>{{ bestRoller() }} is leading the session’s average raw d20.</p>
          </article>
        </div>
      </div>

      <div class="list-stack">
        @for (row of store.analytics()!.rollsPerCharacter; track row.actorName) {
          <article class="list-card ledger-row">
            <div>
              <h3>{{ row.actorName }}</h3>
              <p>{{ row.count }} rolls • avg {{ row.averageRawD20 | number: '1.1-1' }}</p>
            </div>
            <span class="pill">20s {{ row.nat20Count }} / 1s {{ row.nat1Count }}</span>
          </article>
        }
      </div>

      <section class="card engraved-panel graph-card roll-graph-panel">
        <div class="card-header">
          <div>
            <p class="eyebrow">Roll graph</p>
            <h3>Average raw d20 by actor</h3>
          </div>
        </div>
        <div class="bar-graph-list">
          @for (row of averageD20Rows(); track row.actorName) {
            <article class="bar-graph-row">
              <div class="bar-graph-label">
                <span>{{ row.actorName }}</span>
              </div>
              <div class="bar-graph-track">
                <span class="bar-graph-fill sapphire-fill" [style.width.%]="d20Width(row.averageRawD20)"></span>
              </div>
              <strong>{{ row.averageRawD20 | number: '1.1-1' }}</strong>
            </article>
          }
        </div>
      </section>
    }
  `,
})
export class RollTrackerPageComponent {
  readonly store = inject(RollTrackerStore);
  readonly sessionStore = inject(SessionStoreService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  readonly sessionId = signal('');
  readonly quickD20Values = Array.from({ length: 20 }, (_, index) => index + 1);
  readonly advancedOpen = signal(false);
  readonly total = computed(() => this.form.controls.rawD20.value + this.form.controls.modifier.value);
  readonly partyMembers = computed(
    () => this.sessionStore.sessions().find((session) => session.id === this.sessionId())?.partyMembers ?? [],
  );

  readonly form = this.fb.nonNullable.group({
    actorId: [''],
    actorName: [''],
    targetName: [''],
    rollCategory: ['attack', Validators.required],
    rawD20: [10, [Validators.required, Validators.min(1), Validators.max(20)]],
    modifier: [0, Validators.required],
    outcome: ['neutral' as RollOutcome],
    advantageNote: [''],
    note: [''],
  });

  constructor() {
    const sub = this.route.paramMap.subscribe((params) => {
      const sessionId = params.get('sessionId');
      if (sessionId) {
        this.sessionId.set(sessionId);
        void this.store.load(sessionId);
      }
    });
    const actorSub = this.form.controls.actorId.valueChanges.subscribe((actorId) => {
      const actor = this.partyMembers().find((member) => member.id === actorId);
      this.form.patchValue({ actorName: actor?.name ?? '' }, { emitEvent: false });
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
    this.destroyRef.onDestroy(() => actorSub.unsubscribe());
  }

  async submit(): Promise<void> {
    const raw = this.form.getRawValue();
    const actor = this.partyMembers().find((member) => member.id === raw.actorId);
    await this.store.create(this.sessionId(), {
      actorId: raw.actorId || undefined,
      actorName: raw.actorName || actor?.name,
      targetName: raw.targetName || undefined,
      rollCategory: raw.rollCategory as 'attack' | 'skill' | 'defense' | 'recovery' | 'injury' | 'generic',
      rawD20: raw.rawD20,
      modifier: raw.modifier,
      outcome: raw.outcome,
      advantageNote: raw.advantageNote || undefined,
      note: raw.note || undefined,
    });
    this.form.patchValue({
      rawD20: 10,
      modifier: 0,
      note: '',
      targetName: '',
      actorName: '',
      advantageNote: '',
    });
  }

  rollDescriptor(category: string) {
    return rollCategoryIcon(category);
  }

  outcomeDescriptor(outcome: RollOutcome) {
    return resultIcon(outcome);
  }

  setRawD20(value: number): void {
    this.form.patchValue({ rawD20: value });
  }

  bestRoller(): string {
    const rows = this.store.analytics()?.rollsPerCharacter ?? [];
    return [...rows].sort((left, right) => right.averageRawD20 - left.averageRawD20)[0]?.actorName ?? 'No one yet';
  }

  averageD20Rows() {
    return [...(this.store.analytics()?.rollsPerCharacter ?? [])].sort((left, right) => right.averageRawD20 - left.averageRawD20);
  }

  d20Width(value: number): number {
    return (Math.max(0, value) / 20) * 100;
  }
}
