import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ParticipantTemplate, PartyMember } from '@shared/domain';
import { SessionStoreService } from '../../core/session-store.service';

function parseRosterLines(value: string, side: 'pc' | 'enemy'): Array<Omit<PartyMember | ParticipantTemplate, 'id' | 'sessionId'>> {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, role = ''] = line.split('|').map((part) => part.trim());
      return {
        name,
        side,
        role: role || undefined,
      };
    });
}

@Component({
  selector: 'app-session-list-page',
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Sessions</p>
        <h2>Run the table from one place</h2>
        <p>Create a session with party members and optional enemy templates, then branch into rolls, combats, and stage scenes.</p>
      </div>
    </section>

    <div class="layout-columns">
      <section class="card">
        <div class="card-header">
          <h3>New session</h3>
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
            <span>Party members</span>
            <textarea
              formControlName="partyLines"
              rows="8"
              placeholder="Kaladin | Windrunner&#10;Shallan | Lightweaver&#10;Adolin | Duelist"
            ></textarea>
          </label>
          <label>
            <span>Enemy templates</span>
            <textarea
              formControlName="enemyLines"
              rows="8"
              placeholder="Fused Spearman | Elite&#10;Skybreaker Acolyte | Support"
            ></textarea>
          </label>
          <div class="button-row full-width">
            <button type="submit">Create session</button>
          </div>
        </form>
      </section>

      <section class="card">
        <div class="card-header">
          <h3>All sessions</h3>
          <span class="pill">{{ store.sessions().length }}</span>
        </div>

        <div class="list-stack">
          @for (session of store.sessions(); track session.id) {
            <article class="list-card">
              <div>
                <h3>{{ session.title }}</h3>
                <p>{{ session.partyMembers.length }} party • {{ session.combatCount }} combats • {{ session.rollCount }} rolls</p>
                <small>{{ session.stageSceneCount }} stage scenes • updated {{ session.updatedAt | date: 'medium' }}</small>
              </div>
              <div class="button-row">
                <button type="button" (click)="open(session.id)">Open</button>
                <button class="button-outline button-danger" type="button" (click)="remove(session.id)">Delete</button>
              </div>
            </article>
          } @empty {
            <article class="empty-card">No sessions yet. Create one to initialize JSON storage and stage state.</article>
          }
        </div>
      </section>
    </div>
  `,
})
export class SessionListPageComponent {
  readonly store = inject(SessionStoreService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    title: ['Cosmere Session', Validators.required],
    notes: [''],
    partyLines: ['Kaladin | Windrunner\nShallan | Lightweaver\nAdolin | Duelist'],
    enemyLines: ['Fused Spearman | Elite'],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      return;
    }
    const raw = this.form.getRawValue();
    const session = await this.store.createSession({
      title: raw.title,
      notes: raw.notes,
      partyMembers: parseRosterLines(raw.partyLines, 'pc') as Array<Omit<PartyMember, 'id' | 'sessionId'>>,
      participantTemplates: parseRosterLines(raw.enemyLines, 'enemy') as Array<Omit<ParticipantTemplate, 'id' | 'sessionId'>>,
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
}
