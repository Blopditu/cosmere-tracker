import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AppStoreService } from '../core/app-store.service';
import { createId } from '../core/default-data';
import { CombatantInstance, EventType } from '../core/models';

@Component({
  selector: 'app-fight-tracker-page',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    @if (session(); as session) {
      @if (fight(); as fight) {
        <section class="page-header">
          <div>
            <p class="eyebrow">Fight Tracker</p>
            <h1>{{ fight.name }}</h1>
            <p>{{ session.sessionName }} • {{ fight.events.length }} events logged</p>
          </div>
          <div class="button-row">
            <a [routerLink]="['/sessions', session.id]">Back to session</a>
            <button type="button" (click)="endFight()">End fight</button>
          </div>
        </section>

        <div class="grid-two">
          <section class="card">
            <div class="card-header">
              <h2>Combatants</h2>
              <span class="pill">{{ fight.combatants.length }}</span>
            </div>
            <div class="combatant-columns">
              <div>
                <h3>Party</h3>
                <div class="list-stack">
                  @for (actor of party(); track actor.id) {
                    <article class="combatant-card party-card">
                      <div>
                        <h4>{{ actor.name }}</h4>
                        <p>{{ actor.role || 'Party member' }}</p>
                      </div>
                    </article>
                  }
                </div>
              </div>
              <div>
                <div class="card-header compact">
                  <h3>Enemies</h3>
                  <span class="pill pill-enemy">{{ enemies().length }}</span>
                </div>
                <div class="list-stack">
                  @for (actor of enemies(); track actor.id) {
                    <article class="combatant-card enemy-card">
                      <div>
                        <h4>{{ actor.name }}</h4>
                        <p>{{ actor.role || 'Enemy' }}</p>
                      </div>
                      <button class="button-danger" type="button" (click)="removeEnemy(actor.id)">Remove</button>
                    </article>
                  }
                </div>
              </div>
            </div>
          </section>

          <section class="card">
            <div class="card-header">
              <h2>Add enemy</h2>
              <span class="pill">Individual enemy entries</span>
            </div>
            <form class="form-grid" [formGroup]="enemyForm" (ngSubmit)="addEnemy()">
              <label>
                <span>From template</span>
                <select formControlName="templateId" (change)="applyEnemyTemplate()">
                  <option value="">Manual enemy</option>
                  @for (template of enemyTemplates(); track template.id) {
                    <option [value]="template.id">{{ template.name }}</option>
                  }
                </select>
              </label>
              <label>
                <span>Name</span>
                <input formControlName="name" type="text" />
              </label>
              <label>
                <span>Role</span>
                <input formControlName="role" type="text" />
              </label>
              <label>
                <span>Color</span>
                <input formControlName="color" type="color" />
              </label>
              <div class="button-row">
                <button type="submit">Add enemy</button>
              </div>
            </form>
          </section>
        </div>

        <section class="card">
          <div class="card-header">
            <h2>Quick action log</h2>
            <span class="pill">Autosaves to local JSON state</span>
          </div>

          <div class="button-row preset-row">
            @for (preset of presets; track preset) {
              <button class="button-secondary" type="button" (click)="setType(preset)">{{ preset }}</button>
            }
          </div>

          <form class="form-grid" [formGroup]="eventForm" (ngSubmit)="logEvent()">
            <label>
              <span>Actor</span>
              <select formControlName="actorId">
                @for (actor of fight.combatants; track actor.id) {
                  <option [value]="actor.id">{{ actor.name }} ({{ actor.side }})</option>
                }
              </select>
            </label>
            <label>
              <span>Action type</span>
              <select formControlName="type">
                @for (type of eventTypes; track type) {
                  <option [value]="type">{{ type }}</option>
                }
              </select>
            </label>
            <label>
              <span>Dice formula</span>
              <input formControlName="diceFormula" type="text" placeholder="1d20+7 or 2d6" />
            </label>
            <label>
              <span>Roll total</span>
              <input formControlName="rollTotal" type="number" />
            </label>
            <label>
              <span>Modifier</span>
              <input formControlName="modifier" type="number" />
            </label>
            <label>
              <span>Amount</span>
              <input formControlName="amount" type="number" />
            </label>
            <label>
              <span>Outcome</span>
              <select formControlName="outcome">
                <option value="">None</option>
                <option value="hit">hit</option>
                <option value="miss">miss</option>
                <option value="crit">crit</option>
                <option value="success">success</option>
                <option value="failure">failure</option>
              </select>
            </label>
            <label>
              <span>Damage type</span>
              <input formControlName="damageType" type="text" placeholder="slashing, shard, radiant" />
            </label>
            @if (fight.roundTrackingEnabled) {
              <label>
                <span>Round</span>
                <input formControlName="round" type="number" min="1" />
              </label>
            }
            <label class="full-width">
              <span>Note</span>
              <textarea formControlName="note" rows="2"></textarea>
            </label>

            <div class="full-width">
              <span class="field-label">Targets</span>
              <div class="chip-grid">
                @for (target of fight.combatants; track target.id) {
                  <button
                    type="button"
                    class="chip-button"
                    [class.selected]="hasTarget(target.id)"
                    (click)="toggleTarget(target.id)"
                  >
                    {{ target.name }}
                  </button>
                }
              </div>
            </div>

            <div class="full-width">
              <span class="field-label">Support tags</span>
              <div class="chip-grid">
                @for (tag of store.supportTags(); track tag) {
                  <button
                    type="button"
                    class="chip-button"
                    [class.selected]="hasTag(tag)"
                    (click)="toggleTag(tag)"
                  >
                    {{ tag }}
                  </button>
                }
              </div>
            </div>

            <div class="button-row">
              <button type="submit">Log action</button>
            </div>
          </form>
        </section>

        <section class="card">
          <div class="card-header">
            <h2>Recent events</h2>
            <span class="pill">{{ fight.events.length }}</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Round</th>
                  <th>Actor</th>
                  <th>Type</th>
                  <th>Targets</th>
                  <th>Roll</th>
                  <th>Amount</th>
                  <th>Outcome</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (event of recentEvents(); track event.id) {
                  <tr>
                    <td>{{ event.round ?? '-' }}</td>
                    <td>{{ actorName(event.actorId) }}</td>
                    <td>{{ event.type }}</td>
                    <td>{{ targetNames(event.targetIds) }}</td>
                    <td>{{ event.diceFormula || '-' }} {{ event.rollTotal ?? '' }}</td>
                    <td>{{ event.amount ?? '-' }}</td>
                    <td>{{ event.outcome ?? '-' }}</td>
                    <td>
                      <button class="button-danger" type="button" (click)="deleteEvent(event.id)">Delete</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
    } @else {
      <section class="card"><p>Fight not found.</p></section>
    }
  `,
})
export class FightTrackerPageComponent {
  readonly store = inject(AppStoreService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly eventTypes: EventType[] = [
    'attack-roll',
    'damage',
    'healing',
    'saving-throw',
    'support',
    'utility',
    'kill',
    'death',
    'condition',
    'note',
  ];
  readonly presets: EventType[] = [
    'attack-roll',
    'damage',
    'healing',
    'saving-throw',
    'support',
    'utility',
    'kill',
    'death',
  ];
  readonly sessionId = toSignal(this.route.paramMap.pipe(map((params) => params.get('sessionId'))), {
    initialValue: this.route.snapshot.paramMap.get('sessionId'),
  });
  readonly fightId = toSignal(this.route.paramMap.pipe(map((params) => params.get('fightId'))), {
    initialValue: this.route.snapshot.paramMap.get('fightId'),
  });
  readonly session = computed(() => this.store.sessionById(this.sessionId()));
  readonly fight = computed(() => this.store.fightById(this.sessionId(), this.fightId()));
  readonly roster = computed(() =>
    this.store.rosters().find((entry) => entry.id === this.session()?.rosterId) ?? this.store.activeRoster(),
  );
  readonly enemyTemplates = computed(() => this.roster()?.enemyTemplates ?? []);
  readonly party = computed(() => this.fight()?.combatants.filter((entry) => entry.side === 'party') ?? []);
  readonly enemies = computed(() => this.fight()?.combatants.filter((entry) => entry.side === 'enemy') ?? []);
  readonly recentEvents = computed(() => [...(this.fight()?.events ?? [])].reverse().slice(0, 20));

  readonly enemyForm = this.fb.nonNullable.group({
    templateId: [''],
    name: ['', Validators.required],
    role: [''],
    color: ['#f97316'],
  });

  readonly eventForm = this.fb.nonNullable.group({
    actorId: ['', Validators.required],
    type: ['attack-roll' as EventType, Validators.required],
    diceFormula: [''],
    rollTotal: [null as number | null],
    modifier: [null as number | null],
    amount: [null as number | null],
    outcome: [''],
    damageType: [''],
    round: [1],
    targetIds: [[] as string[]],
    supportTags: [[] as string[]],
    note: [''],
  });

  constructor() {
    effect(() => {
      const fight = this.fight();
      if (!fight) {
        return;
      }
      const actorId = this.eventForm.controls.actorId.value;
      if (!actorId || !fight.combatants.some((entry) => entry.id === actorId)) {
        this.eventForm.patchValue(
          {
            actorId: fight.combatants[0]?.id ?? '',
          },
          { emitEvent: false },
        );
      }
      const highestRound = Math.max(...fight.events.map((event) => event.round ?? 1), 1);
      this.eventForm.patchValue({ round: highestRound }, { emitEvent: false });
    });
  }

  applyEnemyTemplate(): void {
    const templateId = this.enemyForm.controls.templateId.value;
    const template = this.enemyTemplates().find((entry) => entry.id === templateId);
    if (!template) {
      return;
    }
    this.enemyForm.patchValue({
      name: template.name,
      role: template.role ?? '',
      color: template.color ?? '#f97316',
    });
  }

  addEnemy(): void {
    const fight = this.fight();
    const sessionId = this.sessionId();
    if (!fight || !sessionId || this.enemyForm.invalid) {
      return;
    }
    const value = this.enemyForm.getRawValue();
    this.store.addEnemyToFight(sessionId, fight.id, {
      id: createId('actor'),
      templateId: value.templateId || undefined,
      name: value.name.trim(),
      side: 'enemy',
      role: value.role.trim() || undefined,
      color: value.color,
      active: true,
    });
    this.enemyForm.reset({
      templateId: '',
      name: '',
      role: '',
      color: '#f97316',
    });
  }

  removeEnemy(combatantId: string): void {
    const sessionId = this.sessionId();
    const fightId = this.fightId();
    if (!sessionId || !fightId || !window.confirm('Remove this enemy and related events?')) {
      return;
    }
    this.store.removeCombatantFromFight(sessionId, fightId, combatantId);
  }

  setType(type: EventType): void {
    this.eventForm.patchValue({ type });
  }

  hasTarget(targetId: string): boolean {
    return this.eventForm.controls.targetIds.value.includes(targetId);
  }

  toggleTarget(targetId: string): void {
    const current = this.eventForm.controls.targetIds.value;
    this.eventForm.patchValue({
      targetIds: current.includes(targetId)
        ? current.filter((entry) => entry !== targetId)
        : [...current, targetId],
    });
  }

  hasTag(tag: string): boolean {
    return this.eventForm.controls.supportTags.value.includes(tag);
  }

  toggleTag(tag: string): void {
    const current = this.eventForm.controls.supportTags.value;
    this.eventForm.patchValue({
      supportTags: current.includes(tag)
        ? current.filter((entry) => entry !== tag)
        : [...current, tag],
    });
  }

  logEvent(): void {
    const fight = this.fight();
    const sessionId = this.sessionId();
    if (!fight || !sessionId || this.eventForm.invalid) {
      return;
    }
    const value = this.eventForm.getRawValue();
    this.store.addEvent(sessionId, fight.id, {
      actorId: value.actorId,
      type: value.type,
      round: fight.roundTrackingEnabled ? value.round ?? undefined : undefined,
      targetIds: value.targetIds,
      diceFormula: value.diceFormula.trim() || undefined,
      rollTotal: value.rollTotal ?? undefined,
      modifier: value.modifier ?? undefined,
      amount: value.amount ?? undefined,
      outcome: value.outcome ? (value.outcome as never) : undefined,
      damageType: value.damageType.trim() || undefined,
      supportTags: value.supportTags.length ? value.supportTags : undefined,
      note: value.note.trim() || undefined,
    });
    const currentRound = value.round ?? 1;
    this.eventForm.patchValue({
      diceFormula: '',
      rollTotal: null,
      modifier: null,
      amount: null,
      outcome: '',
      damageType: '',
      targetIds: [],
      supportTags: [],
      note: '',
      round: currentRound,
    });
  }

  actorName(actorId: string): string {
    return this.fight()?.combatants.find((entry) => entry.id === actorId)?.name ?? 'Unknown actor';
  }

  targetNames(targetIds: string[]): string {
    return targetIds.map((targetId) => this.actorName(targetId)).join(', ') || '-';
  }

  deleteEvent(eventId: string): void {
    const sessionId = this.sessionId();
    const fightId = this.fightId();
    if (!sessionId || !fightId) {
      return;
    }
    this.store.deleteEvent(sessionId, fightId, eventId);
  }

  endFight(): void {
    const sessionId = this.sessionId();
    const fightId = this.fightId();
    if (!sessionId || !fightId) {
      return;
    }
    this.store.markFightEnded(sessionId, fightId);
    void this.router.navigate(['/sessions', sessionId, 'fights', fightId, 'recap']);
  }
}
