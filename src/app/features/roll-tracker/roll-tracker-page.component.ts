import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { RollOutcome } from '@shared/domain';
import { SessionStoreService } from '../../core/session-store.service';
import { RollTrackerStore } from './roll-tracker.store';

@Component({
  selector: 'app-roll-tracker-page',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Global roll tracker</p>
        <h2>Capture every d20 at table speed</h2>
        <p>Independent from combat, but linkable back to rounds and turns when needed.</p>
      </div>
    </section>

    <div class="layout-columns wide">
      <section class="card">
        <div class="card-header">
          <h3>Log roll</h3>
          <span class="pill">Total {{ total() }}</span>
        </div>
        <form class="form-grid" [formGroup]="form" (ngSubmit)="submit()">
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
              <option value="failure">Failure</option>
              <option value="criticalSuccess">Critical success</option>
              <option value="criticalFailure">Critical failure</option>
            </select>
          </label>
          <label>
            <span>Advantage note</span>
            <input formControlName="advantageNote" type="text" placeholder="advantage, disadvantage, plot die..." />
          </label>
          <label class="full-width">
            <span>Note</span>
            <textarea formControlName="note" rows="2"></textarea>
          </label>
          <div class="button-row full-width">
            <button type="submit">Log roll</button>
          </div>
        </form>
      </section>

      <section class="card">
        <div class="card-header">
          <h3>Session analytics</h3>
          <span class="pill">{{ store.analytics()?.totalRolls || 0 }} rolls</span>
        </div>
        @if (store.analytics()) {
          <div class="stats-grid">
            <article class="stat-card">
              <span class="stat-label">Average raw d20</span>
              <strong>{{ store.analytics()!.averageRawD20 | number: '1.1-1' }}</strong>
            </article>
            <article class="stat-card">
              <span class="stat-label">Nat 20s</span>
              <strong>{{ store.analytics()!.nat20Count }}</strong>
            </article>
            <article class="stat-card">
              <span class="stat-label">Nat 1s</span>
              <strong>{{ store.analytics()!.nat1Count }}</strong>
            </article>
            <article class="stat-card">
              <span class="stat-label">Attack accuracy</span>
              <strong>{{ store.analytics()!.attackAccuracy | percent: '1.0-0' }}</strong>
            </article>
          </div>

          <div class="list-stack">
            @for (row of store.analytics()!.rollsPerCharacter; track row.actorName) {
              <article class="list-card">
                <div>
                  <h3>{{ row.actorName }}</h3>
                  <p>{{ row.count }} rolls • avg {{ row.averageRawD20 | number: '1.1-1' }}</p>
                </div>
                <span class="pill">20s {{ row.nat20Count }} / 1s {{ row.nat1Count }}</span>
              </article>
            }
          </div>
        }
      </section>
    </div>

    <section class="card">
      <div class="card-header">
        <h3>Recent roll history</h3>
        <span class="pill">{{ store.rolls().length }}</span>
      </div>
      <div class="list-stack">
        @for (roll of store.rolls(); track roll.id) {
          <article class="timeline-item">
            <strong>{{ roll.actorName || roll.actorId || 'Unknown' }}</strong>
            <p>{{ roll.rollCategory }} vs {{ roll.targetName || 'n/a' }} • {{ roll.total }} total</p>
            <small>{{ roll.timestamp | date: 'short' }} • {{ roll.outcome }}</small>
          </article>
        }
      </div>
    </section>
  `,
})
export class RollTrackerPageComponent {
  readonly store = inject(RollTrackerStore);
  readonly sessionStore = inject(SessionStoreService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  readonly sessionId = signal('');
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
    this.destroyRef.onDestroy(() => sub.unsubscribe());
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
}
