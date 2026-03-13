import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AppStoreService } from '../core/app-store.service';
import { CombatantInstance } from '../core/models';

type PartyMemberForm = FormGroup<{
  id: FormControl<string>;
  name: FormControl<string>;
  role: FormControl<string>;
  color: FormControl<string>;
  active: FormControl<boolean>;
}>;

@Component({
  selector: 'app-session-detail-page',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    @if (session(); as session) {
      <section class="page-header">
        <div>
          <p class="eyebrow">Session Detail</p>
          <h1>{{ session.sessionName }}</h1>
          <p>{{ session.campaignName }} • {{ session.playedOn }}</p>
        </div>
        <div class="button-row">
          <a [routerLink]="['/sessions', session.id, 'recap']">Session recap</a>
        </div>
      </section>

      <section class="card">
        <div class="card-header">
          <h2>Session info</h2>
          <span class="pill">{{ session.fights.length }} fights</span>
        </div>
        <form class="form-grid" [formGroup]="sessionForm" (ngSubmit)="saveSession()">
          <label>
            <span>Campaign name</span>
            <input formControlName="campaignName" type="text" />
          </label>
          <label>
            <span>Session name</span>
            <input formControlName="sessionName" type="text" />
          </label>
          <label>
            <span>Played on</span>
            <input formControlName="playedOn" type="date" />
          </label>
          <label class="full-width">
            <span>Notes</span>
            <textarea formControlName="notes" rows="3"></textarea>
          </label>
          <div class="button-row">
            <button type="submit">Save session</button>
          </div>
        </form>
      </section>

      <section class="card">
        <div class="card-header">
          <h2>Party for this session</h2>
          <span class="pill pill-party">{{ partyArray.length }}</span>
        </div>
        <form [formGroup]="partyForm" (ngSubmit)="saveParty()">
          <div formArrayName="party" class="list-stack">
            @for (member of partyArray.controls; track member.controls.id.value; let index = $index) {
              <div class="party-editor" [formGroupName]="index">
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
                <label class="checkbox-row">
                  <input formControlName="active" type="checkbox" />
                  <span>Active</span>
                </label>
              </div>
            }
          </div>
          <div class="button-row">
            <button type="submit">Save party lineup</button>
          </div>
        </form>
      </section>

      <section class="card">
        <div class="card-header">
          <h2>Add fight</h2>
          <span class="pill">Round tracking optional</span>
        </div>
        <form class="form-grid" [formGroup]="fightForm" (ngSubmit)="createFight()">
          <label>
            <span>Fight name</span>
            <input formControlName="name" type="text" />
          </label>
          <label class="checkbox-row">
            <input formControlName="roundTrackingEnabled" type="checkbox" />
            <span>Enable round tracking</span>
          </label>
          <label class="full-width">
            <span>Notes</span>
            <textarea formControlName="notes" rows="2"></textarea>
          </label>
          <div class="button-row">
            <button type="submit">Create fight</button>
          </div>
        </form>
      </section>

      <section class="card">
        <div class="card-header">
          <h2>Fights</h2>
          <span class="pill">{{ session.fights.length }}</span>
        </div>
        <div class="list-stack">
          @for (fight of session.fights; track fight.id) {
            <article class="list-card">
              <div>
                <h3>{{ fight.name }}</h3>
                <p>{{ fight.combatants.filter(isEnemy).length }} enemies • {{ fight.events.length }} logged events</p>
              </div>
              <div class="button-row">
                <a [routerLink]="['/sessions', session.id, 'fights', fight.id]">Track</a>
                <a [routerLink]="['/sessions', session.id, 'fights', fight.id, 'recap']" class="button-secondary">Recap</a>
                <button class="button-secondary" type="button" (click)="duplicateFight(fight.id)">Duplicate</button>
                <button class="button-danger" type="button" (click)="deleteFight(fight.id)">Delete</button>
              </div>
            </article>
          }
        </div>
      </section>
    } @else {
      <section class="card"><p>Session not found.</p></section>
    }
  `,
})
export class SessionDetailPageComponent {
  readonly store = inject(AppStoreService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  readonly sessionId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('sessionId'))),
    { initialValue: this.route.snapshot.paramMap.get('sessionId') },
  );
  readonly session = computed(() => this.store.sessionById(this.sessionId()));

  readonly sessionForm = this.fb.nonNullable.group({
    campaignName: ['', Validators.required],
    sessionName: ['', Validators.required],
    playedOn: ['', Validators.required],
    notes: [''],
  });

  readonly partyForm = this.fb.nonNullable.group({
    party: this.fb.array<PartyMemberForm>([]),
  });

  readonly fightForm = this.fb.nonNullable.group({
    name: [''],
    roundTrackingEnabled: [true],
    notes: [''],
  });

  get partyArray(): FormArray<PartyMemberForm> {
    return this.partyForm.controls.party;
  }

  constructor() {
    effect(() => {
      const session = this.session();
      if (!session) {
        return;
      }
      this.sessionForm.patchValue(
        {
          campaignName: session.campaignName,
          sessionName: session.sessionName,
          playedOn: session.playedOn,
          notes: session.notes ?? '',
        },
        { emitEvent: false },
      );
      this.fightForm.patchValue({ name: `Fight ${session.fights.length + 1}` }, { emitEvent: false });
      this.partyArray.clear({ emitEvent: false });
      for (const member of session.party) {
        this.partyArray.push(this.createPartyGroup(member), { emitEvent: false });
      }
    });
  }

  isEnemy = (combatant: CombatantInstance) => combatant.side === 'enemy';

  saveSession(): void {
    const session = this.session();
    if (!session || this.sessionForm.invalid) {
      return;
    }
    this.store.updateSession(session.id, this.sessionForm.getRawValue());
  }

  saveParty(): void {
    const session = this.session();
    if (!session) {
      return;
    }
    this.store.updateSession(session.id, {
      party: this.partyArray.getRawValue().map((member) => ({
        ...member,
        side: 'party',
        templateId: session.party.find((entry) => entry.id === member.id)?.templateId,
      })),
    });
  }

  createFight(): void {
    const session = this.session();
    if (!session) {
      return;
    }
    this.store.createFight(session.id, this.fightForm.getRawValue());
    this.fightForm.patchValue({ name: `Fight ${session.fights.length + 2}`, notes: '' });
  }

  duplicateFight(fightId: string): void {
    const session = this.session();
    if (!session) {
      return;
    }
    this.store.duplicateFight(session.id, fightId);
  }

  deleteFight(fightId: string): void {
    const session = this.session();
    if (!session || !window.confirm('Delete this fight?')) {
      return;
    }
    this.store.deleteFight(session.id, fightId);
  }

  private createPartyGroup(member: CombatantInstance): PartyMemberForm {
    return this.fb.nonNullable.group({
      id: this.fb.nonNullable.control(member.id),
      name: this.fb.nonNullable.control(member.name),
      role: this.fb.nonNullable.control(member.role ?? ''),
      color: this.fb.nonNullable.control(member.color ?? '#22c55e'),
      active: this.fb.nonNullable.control(member.active),
    });
  }
}
