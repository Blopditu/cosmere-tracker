import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppStoreService } from '../core/app-store.service';

@Component({
  selector: 'app-sessions-page',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DatePipe],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Sessions</p>
        <h1>Track each session and every fight</h1>
        <p>Create a session from your active roster, then drill into fights, recaps, and analytics.</p>
      </div>
    </section>

    <section class="card">
      <div class="card-header">
        <h2>New session</h2>
        <span class="pill">Active roster: {{ store.activeRoster().name }}</span>
      </div>
      <form class="form-grid" [formGroup]="sessionForm" (ngSubmit)="createSession()">
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
          <textarea formControlName="notes" rows="2"></textarea>
        </label>
        <div class="button-row">
          <button type="submit">Create session</button>
        </div>
      </form>
    </section>

    <div class="grid-two">
      <section class="card">
        <div class="card-header">
          <h2>Active sessions</h2>
          <span class="pill">{{ activeSessions().length }}</span>
        </div>
        <div class="list-stack">
          @for (session of activeSessions(); track session.id) {
            <article class="list-card">
              <div>
                <h3>{{ session.sessionName }}</h3>
                <p>{{ session.campaignName }} • {{ session.playedOn | date: 'mediumDate' }}</p>
                <small>{{ session.fights.length }} fights • {{ session.party.length }} party members</small>
              </div>
              <div class="button-row">
                <a [routerLink]="['/sessions', session.id]">Open</a>
                <a [routerLink]="['/sessions', session.id, 'recap']" class="button-secondary">Recap</a>
                <button class="button-secondary" type="button" (click)="duplicateSession(session.id)">Duplicate</button>
                <button class="button-secondary" type="button" (click)="archiveSession(session.id, true)">Archive</button>
                <button class="button-danger" type="button" (click)="deleteSession(session.id)">Delete</button>
              </div>
            </article>
          }
        </div>
      </section>

      <section class="card">
        <div class="card-header">
          <h2>Archived sessions</h2>
          <span class="pill">{{ archivedSessions().length }}</span>
        </div>
        <div class="list-stack">
          @for (session of archivedSessions(); track session.id) {
            <article class="list-card">
              <div>
                <h3>{{ session.sessionName }}</h3>
                <p>{{ session.campaignName }} • {{ session.playedOn | date: 'mediumDate' }}</p>
              </div>
              <div class="button-row">
                <button class="button-secondary" type="button" (click)="archiveSession(session.id, false)">Restore</button>
                <button class="button-danger" type="button" (click)="deleteSession(session.id)">Delete</button>
              </div>
            </article>
          }
        </div>
      </section>
    </div>
  `,
})
export class SessionsPageComponent {
  readonly store = inject(AppStoreService);
  private readonly fb = inject(FormBuilder);

  readonly sessionForm = this.fb.nonNullable.group({
    campaignName: ['Cosmere Campaign', Validators.required],
    sessionName: [`Session ${new Date().toLocaleDateString()}`, Validators.required],
    playedOn: [new Date().toISOString().slice(0, 10), Validators.required],
    notes: [''],
  });

  activeSessions = () => this.store.sessions().filter((session) => !session.archived);
  archivedSessions = () => this.store.sessions().filter((session) => session.archived);

  createSession(): void {
    if (this.sessionForm.invalid) {
      return;
    }
    this.store.createSession(this.sessionForm.getRawValue());
    this.sessionForm.patchValue({
      sessionName: `Session ${new Date().toLocaleDateString()}`,
      playedOn: new Date().toISOString().slice(0, 10),
      notes: '',
    });
  }

  duplicateSession(sessionId: string): void {
    this.store.duplicateSession(sessionId);
  }

  archiveSession(sessionId: string, archived: boolean): void {
    this.store.archiveSession(sessionId, archived);
  }

  deleteSession(sessionId: string): void {
    if (!window.confirm('Delete this session and all fights?')) {
      return;
    }
    this.store.deleteSession(sessionId);
  }
}
