import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SessionDashboard } from '@shared/domain';
import { SessionStoreService } from '../../core/session-store.service';

@Component({
  selector: 'app-session-dashboard-page',
  imports: [CommonModule, RouterLink],
  template: `
    @if (dashboard()) {
      <section class="page-header">
        <div>
          <p class="eyebrow">Session dashboard</p>
          <h2>{{ dashboard()!.session.title }}</h2>
          <p>{{ dashboard()!.session.notes || 'No GM notes yet.' }}</p>
        </div>
        <div class="button-row" data-tour="dashboard-actions">
          <a [routerLink]="['/sessions', dashboard()!.session.id, 'rolls']">Open rolls</a>
          <a [routerLink]="['/sessions', dashboard()!.session.id, 'combats', 'new']" class="button-outline">New combat</a>
          <a [routerLink]="['/gm/stage-manager', dashboard()!.session.id]" class="button-outline">Stage manager</a>
        </div>
      </section>

      <div class="stats-grid">
        <article class="card stat-card">
          <span class="stat-label">Party members</span>
          <strong>{{ dashboard()!.session.partyMembers.length }}</strong>
        </article>
        <article class="card stat-card">
          <span class="stat-label">Rolls logged</span>
          <strong>{{ dashboard()!.session.rollCount }}</strong>
        </article>
        <article class="card stat-card">
          <span class="stat-label">Combats</span>
          <strong>{{ dashboard()!.session.combatCount }}</strong>
        </article>
        <article class="card stat-card">
          <span class="stat-label">Stage scenes</span>
          <strong>{{ dashboard()!.session.stageSceneCount }}</strong>
        </article>
      </div>

      <div class="layout-columns">
        <section class="card" data-tour="dashboard-party">
          <div class="card-header">
            <h3>Party overview</h3>
            <span class="pill">Session cast</span>
          </div>
          <div class="list-stack">
            @for (member of dashboard()!.session.partyMembers; track member.id) {
              <article class="list-card">
                <div>
                  <h3>{{ member.name }}</h3>
                  <p>{{ member.role || 'No role set' }}</p>
                </div>
                <span class="tag-chip">{{ member.maxFocus ?? 0 }} focus</span>
              </article>
            }
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h3>Recent rolls</h3>
            <span class="pill">{{ dashboard()!.recentRolls.length }}</span>
          </div>
          <div class="list-stack">
            @for (roll of dashboard()!.recentRolls; track roll.id) {
              <article class="timeline-item">
                <strong>{{ roll.actorName || roll.actorId || 'Unknown' }}</strong>
                <p>{{ roll.rollCategory }} • d20 {{ roll.rawD20 }} + {{ roll.modifier }} = {{ roll.total }}</p>
              </article>
            } @empty {
              <article class="empty-card">No rolls yet.</article>
            }
          </div>
        </section>
      </div>

      <section class="card" data-tour="dashboard-combats">
        <div class="card-header">
          <h3>Recent combats</h3>
          <span class="pill">{{ dashboard()!.recentCombats.length }}</span>
        </div>
        <div class="list-stack">
          @for (combat of dashboard()!.recentCombats; track combat.id) {
            <article class="list-card">
              <div>
                <h3>{{ combat.title }}</h3>
                <p>{{ combat.status }} • round {{ combat.currentRoundNumber || 0 }}</p>
              </div>
              <a [routerLink]="['/sessions', dashboard()!.session.id, 'combats', combat.id]">Open</a>
            </article>
          } @empty {
            <article class="empty-card">No combats started yet.</article>
          }
        </div>
      </section>
    } @else {
      <section class="card empty-card">Loading session dashboard...</section>
    }
  `,
})
export class SessionDashboardPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly sessionStore = inject(SessionStoreService);
  private readonly destroyRef = inject(DestroyRef);
  readonly dashboard = signal<SessionDashboard | null>(null);

  constructor() {
    const sub = this.route.paramMap.subscribe((params) => {
      const sessionId = params.get('sessionId');
      if (sessionId) {
        void this.load(sessionId);
      }
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  private async load(sessionId: string): Promise<void> {
    this.dashboard.set(await this.sessionStore.getDashboard(sessionId));
  }
}
