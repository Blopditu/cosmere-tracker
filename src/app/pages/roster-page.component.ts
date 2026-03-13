import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppStoreService } from '../core/app-store.service';
import { CombatantTemplate } from '../core/models';

@Component({
  selector: 'app-roster-page',
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Roster</p>
        <h1>Party and enemy templates</h1>
        <p>Manage reusable players and enemy types for future sessions and fights.</p>
      </div>
      <div class="button-row">
        <button class="button-secondary" type="button" (click)="createRoster()">New roster</button>
      </div>
    </section>

    <div class="grid-two">
      <section class="card">
        <div class="card-header">
          <h2>Roster library</h2>
          <span class="pill">{{ store.rosters().length }} saved</span>
        </div>
        <div class="list-stack">
          @for (roster of store.rosters(); track roster.id) {
            <button
              type="button"
              class="list-item-button"
              [class.active]="roster.id === activeRosterId()"
              (click)="selectRoster(roster.id)"
            >
              <span>{{ roster.name }}</span>
              <small>{{ roster.partyTemplates.length }} party / {{ roster.enemyTemplates.length }} enemy</small>
            </button>
          }
        </div>
      </section>

      @if (activeRoster(); as roster) {
        <section class="card">
          <div class="card-header">
            <h2>Edit roster</h2>
            <span class="pill">Active</span>
          </div>
          <form class="form-grid" [formGroup]="rosterForm" (ngSubmit)="saveRosterName()">
            <label>
              <span>Name</span>
              <input formControlName="name" type="text" />
            </label>
            <div class="button-row">
              <button type="submit">Save roster name</button>
            </div>
          </form>
        </section>
      }
    </div>

    @if (activeRoster(); as roster) {
      <div class="grid-two">
        <section class="card">
          <div class="card-header">
            <h2>Party templates</h2>
            <span class="pill pill-party">{{ roster.partyTemplates.length }}</span>
          </div>
          <form class="form-grid" [formGroup]="partyTemplateForm" (ngSubmit)="saveTemplate('party')">
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
            <label class="full-width">
              <span>Notes</span>
              <textarea formControlName="notes" rows="2"></textarea>
            </label>
            <div class="button-row">
              <button type="submit">{{ editingPartyId() ? 'Update template' : 'Add party member' }}</button>
              @if (editingPartyId()) {
                <button class="button-secondary" type="button" (click)="resetTemplateForm('party')">Cancel</button>
              }
            </div>
          </form>
          <div class="list-stack">
            @for (template of roster.partyTemplates; track template.id) {
              <article class="list-card">
                <div>
                  <h3>{{ template.name }}</h3>
                  <p>{{ template.role || 'Party member' }}</p>
                </div>
                <div class="button-row">
                  <button class="button-secondary" type="button" (click)="editTemplate('party', template)">Edit</button>
                  <button class="button-danger" type="button" (click)="removeTemplate('party', template.id)">Delete</button>
                </div>
              </article>
            }
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2>Enemy templates</h2>
            <span class="pill pill-enemy">{{ roster.enemyTemplates.length }}</span>
          </div>
          <form class="form-grid" [formGroup]="enemyTemplateForm" (ngSubmit)="saveTemplate('enemy')">
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
            <label class="full-width">
              <span>Notes</span>
              <textarea formControlName="notes" rows="2"></textarea>
            </label>
            <div class="button-row">
              <button type="submit">{{ editingEnemyId() ? 'Update template' : 'Add enemy' }}</button>
              @if (editingEnemyId()) {
                <button class="button-secondary" type="button" (click)="resetTemplateForm('enemy')">Cancel</button>
              }
            </div>
          </form>
          <div class="list-stack">
            @for (template of roster.enemyTemplates; track template.id) {
              <article class="list-card">
                <div>
                  <h3>{{ template.name }}</h3>
                  <p>{{ template.role || 'Enemy' }}</p>
                </div>
                <div class="button-row">
                  <button class="button-secondary" type="button" (click)="editTemplate('enemy', template)">Edit</button>
                  <button class="button-danger" type="button" (click)="removeTemplate('enemy', template.id)">Delete</button>
                </div>
              </article>
            }
          </div>
        </section>
      </div>
    }
  `,
})
export class RosterPageComponent {
  readonly store = inject(AppStoreService);
  private readonly fb = inject(FormBuilder);

  readonly activeRoster = computed(() => this.store.activeRoster());
  readonly activeRosterId = computed(() => this.activeRoster()?.id ?? '');
  readonly editingPartyId = signal('');
  readonly editingEnemyId = signal('');

  readonly rosterForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
  });

  readonly partyTemplateForm = this.fb.nonNullable.group({
    id: [''],
    name: ['', Validators.required],
    role: [''],
    color: ['#22c55e'],
    notes: [''],
  });

  readonly enemyTemplateForm = this.fb.nonNullable.group({
    id: [''],
    name: ['', Validators.required],
    role: [''],
    color: ['#f97316'],
    notes: [''],
  });

  constructor() {
    effect(() => {
      const roster = this.activeRoster();
      if (!roster) {
        return;
      }
      this.rosterForm.patchValue({ name: roster.name }, { emitEvent: false });
    });
  }

  createRoster(): void {
    this.store.createRoster(`Roster ${this.store.rosters().length + 1}`);
  }

  selectRoster(rosterId: string): void {
    this.store.setActiveRoster(rosterId);
    this.resetTemplateForm('party');
    this.resetTemplateForm('enemy');
  }

  saveRosterName(): void {
    const roster = this.activeRoster();
    if (!roster || this.rosterForm.invalid) {
      return;
    }
    this.store.updateRoster(roster.id, { name: this.rosterForm.getRawValue().name.trim() });
  }

  editTemplate(side: 'party' | 'enemy', template: CombatantTemplate): void {
    const form = side === 'party' ? this.partyTemplateForm : this.enemyTemplateForm;
    form.reset({
      id: template.id,
      name: template.name,
      role: template.role ?? '',
      color: template.color ?? (side === 'party' ? '#22c55e' : '#f97316'),
      notes: template.notes ?? '',
    });
    if (side === 'party') {
      this.editingPartyId.set(template.id);
    } else {
      this.editingEnemyId.set(template.id);
    }
  }

  saveTemplate(side: 'party' | 'enemy'): void {
    const roster = this.activeRoster();
    const form = side === 'party' ? this.partyTemplateForm : this.enemyTemplateForm;
    if (!roster || form.invalid) {
      return;
    }
    this.store.upsertTemplate(roster.id, side, form.getRawValue());
    this.resetTemplateForm(side);
  }

  resetTemplateForm(side: 'party' | 'enemy'): void {
    const form = side === 'party' ? this.partyTemplateForm : this.enemyTemplateForm;
    form.reset({
      id: '',
      name: '',
      role: '',
      color: side === 'party' ? '#22c55e' : '#f97316',
      notes: '',
    });
    if (side === 'party') {
      this.editingPartyId.set('');
    } else {
      this.editingEnemyId.set('');
    }
  }

  removeTemplate(side: 'party' | 'enemy', templateId: string): void {
    const roster = this.activeRoster();
    if (!roster || !window.confirm('Delete this template?')) {
      return;
    }
    this.store.removeTemplate(roster.id, side, templateId);
  }
}
