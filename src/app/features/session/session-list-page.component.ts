import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { FullAppBackup, ParticipantTemplate, PartyMember, SessionBackup, createEmptyCharacterStatSheet } from '@shared/domain';
import { SessionStoreService } from '../../core/session-store.service';
import { RosharIconComponent } from '../../shared/roshar-icon.component';

function parseRosterLines(value: string, side: 'pc' | 'enemy'): Array<Omit<PartyMember | ParticipantTemplate, 'id'>> {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, role = '', maxHealth = '', maxFocus = ''] = line.split('|').map((part) => part.trim());
      return {
        name,
        side,
        role: role || undefined,
        stats: createEmptyCharacterStatSheet(),
        maxHealth: maxHealth ? Number(maxHealth) : undefined,
        maxFocus: maxFocus ? Number(maxFocus) : undefined,
        maxInvestiture: undefined,
      };
    });
}

@Component({
  selector: 'app-session-list-page',
  imports: [CommonModule, ReactiveFormsModule, DatePipe, RosharIconComponent],
  template: `
    <section class="page-header session-index-header card engraved-panel">
      <div class="route-heading">
        <p class="eyebrow">Sessions</p>
        <h2>Campaign ledger</h2>
        <p>Prepare a new session, keep Git-friendly JSON backups nearby, and reopen any campaign record without digging through separate tools.</p>
      </div>
      <div class="session-index-summary">
        <article class="route-stat sapphire">
            <app-roshar-icon key="sessions" label="Sessions logged" tone="sapphire" [size]="18" />
            <span class="eyebrow">Sessions</span>
            <strong>{{ store.sessions().length }}</strong>
        </article>
        <article class="route-stat topaz">
            <app-roshar-icon key="dashboard" label="Party seeds" tone="topaz" [size]="18" />
            <span class="eyebrow">Player seeds</span>
            <strong>{{ partySeedCount() }}</strong>
        </article>
        <article class="route-stat ruby">
            <app-roshar-icon key="combat" label="Enemy seeds" tone="ruby" [size]="18" />
            <span class="eyebrow">Enemy seeds</span>
            <strong>{{ enemySeedCount() }}</strong>
        </article>
      </div>
      <div class="button-row">
        <a class="button-outline shell-shortcut" routerLink="/campaign/roster">
          <app-roshar-icon key="dashboard" label="Open campaign roster" tone="topaz" [size]="16" />
          <span>Campaign roster</span>
        </a>
      </div>
    </section>

    <div class="layout-columns session-index-columns">
      <section class="card engraved-panel session-create-card" data-tour="session-create">
        <div class="card-header">
          <div>
            <p class="eyebrow">Campaign forge</p>
            <h3>New session</h3>
          </div>
          <span class="pill">Fresh v2 backend</span>
        </div>

        <form class="form-grid" [formGroup]="form" (ngSubmit)="submit()">
          <label class="full-width">
            <span>Session title</span>
            <input formControlName="title" type="text" placeholder="Words of Radiance - Session 7" />
          </label>
          <label class="full-width">
            <span>GM notes</span>
            <textarea formControlName="notes" rows="3" placeholder="Travel to Urithiru, duel in the tower..."></textarea>
          </label>
          <label>
            <span>Campaign players to seed</span>
            <textarea
              formControlName="partyLines"
              rows="8"
              placeholder="Kaladin | Windrunner | 18 | 4&#10;Shallan | Lightweaver | 14 | 5&#10;Adolin | Duelist | 20 | 3"
            ></textarea>
          </label>
          <label>
            <span>Campaign enemy templates to seed</span>
            <textarea
              formControlName="enemyLines"
              rows="8"
              placeholder="Fused Spearman | Elite | 12 | 2&#10;Skybreaker Acolyte | Support | 10 | 3"
            ></textarea>
          </label>
          <div class="button-row full-width">
            <button type="submit">Create session</button>
          </div>
        </form>
      </section>

      <section class="card engraved-panel backup-panel">
        <div class="card-header">
          <div>
            <p class="eyebrow">JSON safety</p>
            <h3>Backup and import</h3>
          </div>
          <span class="pill">Git-friendly snapshots</span>
        </div>
        <div class="list-stack backup-stack">
          <div class="inset-panel">
            <div class="section-heading">
              <app-roshar-icon key="chronicle" label="Whole app backup" tone="topaz" [size]="18" />
              <h3>Whole app</h3>
            </div>
            <p>Export all runtime JSON collections, or replace them from a JSON backup. Uploaded images stay unmanaged.</p>
            <div class="button-row">
              <button type="button" class="shell-shortcut" (click)="exportFullApp()">
                <app-roshar-icon key="chronicle" label="Export full app" tone="gold" [size]="16" />
                <span>Export full app JSON</span>
              </button>
              <label class="button-outline shell-shortcut file-trigger">
                <app-roshar-icon key="sessions" label="Choose full app import file" tone="topaz" [size]="16" />
                <span>{{ fullAppFileName() || 'Choose import file' }}</span>
                <input type="file" accept="application/json" (change)="pickFullAppFile($event)" />
              </label>
              <button type="button" class="button-outline shell-shortcut" [disabled]="!fullAppBackup()" (click)="importFullApp()">
                <app-roshar-icon key="aid" label="Import full app" tone="ruby" [size]="16" />
                <span>Replace from JSON</span>
              </button>
            </div>
          </div>
          <div class="inset-panel">
            <div class="section-heading">
              <app-roshar-icon key="sessions" label="Session import" tone="sapphire" [size]="18" />
              <h3>Session import</h3>
            </div>
            <p>Import a single session snapshot as a new session copy with remapped IDs and preserved image paths.</p>
            <div class="button-row">
              <label class="button-outline shell-shortcut file-trigger">
                <app-roshar-icon key="sessions" label="Choose session import file" tone="sapphire" [size]="16" />
                <span>{{ sessionImportFileName() || 'Choose session JSON' }}</span>
                <input type="file" accept="application/json" (change)="pickSessionImportFile($event)" />
              </label>
              <button type="button" class="button-outline shell-shortcut" [disabled]="!sessionBackup()" (click)="importSession()">
                <app-roshar-icon key="aid" label="Import session" tone="emerald" [size]="16" />
                <span>Import session copy</span>
              </button>
            </div>
            @if (importMessage()) {
              <p class="import-message">{{ importMessage() }}</p>
            }
          </div>
        </div>
      </section>
    </div>

    <section class="card engraved-panel session-ledger-card" data-tour="session-list">
      <div class="card-header">
        <div>
          <p class="eyebrow">Campaign records</p>
          <h3>All sessions</h3>
        </div>
        <span class="pill">{{ store.sessions().length }}</span>
      </div>
      <div class="list-stack">
        @for (session of store.sessions(); track session.id) {
          <article class="list-card ledger-row session-ledger-row">
            <div class="session-ledger-main">
              <h3>{{ session.title }}</h3>
              <p>{{ session.partyMembers.length }} session players • {{ session.combatCount }} combats • {{ session.rollCount }} rolls</p>
              <small>{{ session.stageSceneCount }} stage scenes • updated {{ session.updatedAt | date: 'medium' }}</small>
            </div>
            <div class="session-ledger-actions">
              <button type="button" class="shell-shortcut" (click)="open(session.id)">
                <app-roshar-icon key="dashboard" label="Open session" tone="gold" [size]="16" />
                <span>Open</span>
              </button>
              <button type="button" class="button-outline shell-shortcut" (click)="exportSession(session.id, session.title)">
                <app-roshar-icon key="chronicle" label="Export session JSON" tone="topaz" [size]="16" />
                <span>Export JSON</span>
              </button>
              <button class="button-outline button-danger shell-shortcut" type="button" (click)="remove(session.id)">
                <app-roshar-icon key="damage" label="Delete session" tone="ruby" [size]="16" />
                <span>Delete</span>
              </button>
            </div>
          </article>
        } @empty {
          <article class="empty-card">No sessions in the ledger yet. Forge one on the left to initialize the table record.</article>
        }
      </div>
    </section>
  `,
})
export class SessionListPageComponent {
  readonly store = inject(SessionStoreService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  readonly fullAppBackup = signal<FullAppBackup | null>(null);
  readonly sessionBackup = signal<SessionBackup | null>(null);
  readonly fullAppFileName = signal('');
  readonly sessionImportFileName = signal('');
  readonly importMessage = signal('');

  readonly form = this.fb.nonNullable.group({
    title: ['Cosmere Session', Validators.required],
    notes: [''],
    partyLines: ['Kaladin | Windrunner | 18 | 4\nShallan | Lightweaver | 14 | 5\nAdolin | Duelist | 20 | 3'],
    enemyLines: ['Fused Spearman | Elite | 12 | 2'],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      return;
    }
    const raw = this.form.getRawValue();
    const session = await this.store.createSession({
      title: raw.title,
      notes: raw.notes,
      partyMembers: parseRosterLines(raw.partyLines, 'pc') as Array<Omit<PartyMember, 'id'>>,
      participantTemplates: parseRosterLines(raw.enemyLines, 'enemy') as Array<Omit<ParticipantTemplate, 'id'>>,
    });
    await this.router.navigate(['/sessions', session.id]);
  }

  open(sessionId: string): void {
    void this.router.navigate(['/sessions', sessionId]);
  }

  remove(sessionId: string): void {
    if (!window.confirm('Delete this session and all associated data?')) {
      return;
    }
    void this.store.deleteSession(sessionId);
  }

  partySeedCount(): number {
    return this.form.controls.partyLines.value.split('\n').map((line) => line.trim()).filter((line) => line.length > 0).length;
  }

  enemySeedCount(): number {
    return this.form.controls.enemyLines.value.split('\n').map((line) => line.trim()).filter((line) => line.length > 0).length;
  }

  async exportFullApp(): Promise<void> {
    const backup = await this.store.exportFullApp();
    this.downloadJson(`cosmere-tracker-full-backup-${new Date().toISOString().slice(0, 10)}.json`, backup);
  }

  async exportSession(sessionId: string, title: string): Promise<void> {
    const backup = await this.store.exportSession(sessionId);
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    this.downloadJson(`${slug || 'session'}-backup.json`, backup);
  }

  async pickFullAppFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.fullAppFileName.set(file.name);
    this.fullAppBackup.set(await this.readJsonFile<FullAppBackup>(file));
  }

  async pickSessionImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.sessionImportFileName.set(file.name);
    this.sessionBackup.set(await this.readJsonFile<SessionBackup>(file));
  }

  async importFullApp(): Promise<void> {
    const backup = this.fullAppBackup();
    if (!backup) {
      return;
    }
    if (!window.confirm('Replace all runtime JSON data from this backup? Uploaded images will not be touched.')) {
      return;
    }
    const result = await this.store.importFullApp(backup);
    this.importMessage.set(result.message);
    this.fullAppBackup.set(null);
    this.fullAppFileName.set('');
  }

  async importSession(): Promise<void> {
    const backup = this.sessionBackup();
    if (!backup) {
      return;
    }
    if (!window.confirm('Import this session backup as a new session copy?')) {
      return;
    }
    const result = await this.store.importSession(backup);
    this.importMessage.set(result.importedSessionTitle ? `${result.message} ${result.importedSessionTitle}` : result.message);
    this.sessionBackup.set(null);
    this.sessionImportFileName.set('');
  }

  private downloadJson(filename: string, payload: unknown): void {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private async readJsonFile<T>(file: File): Promise<T> {
    const text = await file.text();
    return JSON.parse(text) as T;
  }
}
