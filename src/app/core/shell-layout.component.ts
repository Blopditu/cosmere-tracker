import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { SessionStoreService } from './session-store.service';
import { TourOverlayComponent } from './tour-overlay.component';
import { TourRouteKey, TourService } from './tour.service';

@Component({
  selector: 'app-shell-layout',
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, RouterOutlet, TourOverlayComponent],
  template: `
    <div class="app-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Cosmere Tracker</p>
          <h1>GM command console</h1>
        </div>

        <div class="topbar-actions">
          <label class="compact-field" data-tour="session-switcher">
            <span>Active session</span>
            <select [ngModel]="currentSessionId()" (ngModelChange)="goToSession($event)">
              <option value="">Choose session</option>
              @for (session of store.sessions(); track session.id) {
                <option [value]="session.id">{{ session.title }}</option>
              }
            </select>
          </label>
          <a class="button-outline" routerLink="/sessions">Sessions</a>
          <button type="button" class="icon-button" data-tour="help-button" (click)="startTour()" aria-label="Open guided tour">?</button>
        </div>
      </header>

      <div class="shell-divider"></div>

      <div class="shell-grid">
        <aside class="module-nav card" data-tour="module-nav">
          <a routerLink="/sessions" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Session index</a>
          <a [routerLink]="sessionRoute()" routerLinkActive="active">Dashboard</a>
          <a [routerLink]="rollRoute()" routerLinkActive="active">Roll tracker</a>
          <a [routerLink]="combatRoute()" routerLinkActive="active">Combat setup</a>
          <a [routerLink]="stageRoute()" routerLinkActive="active">Stage manager</a>
        </aside>

        <main class="shell-content">
          <router-outlet />
        </main>
      </div>
    </div>

    <app-tour-overlay />
  `,
})
export class ShellLayoutComponent {
  readonly store = inject(SessionStoreService);
  private readonly tour = inject(TourService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly currentSessionId = signal('');

  readonly sessionRoute = computed(() =>
    this.currentSessionId() ? ['/sessions', this.currentSessionId()] : ['/sessions'],
  );
  readonly rollRoute = computed(() =>
    this.currentSessionId() ? ['/sessions', this.currentSessionId(), 'rolls'] : ['/sessions'],
  );
  readonly combatRoute = computed(() =>
    this.currentSessionId() ? ['/sessions', this.currentSessionId(), 'combats', 'new'] : ['/sessions'],
  );
  readonly stageRoute = computed(() =>
    this.currentSessionId() ? ['/gm/stage-manager', this.currentSessionId()] : ['/sessions'],
  );

  constructor() {
    const syncRoute = () => {
      let snapshot = this.activatedRoute.snapshot;
      while (snapshot.firstChild) {
        snapshot = snapshot.firstChild;
      }
      this.currentSessionId.set(snapshot.paramMap.get('sessionId') ?? '');
    };

    syncRoute();
    const sub = this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.tour.close();
      syncRoute();
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  goToSession(sessionId: string): void {
    if (!sessionId) {
      void this.router.navigate(['/sessions']);
      return;
    }
    void this.router.navigate(['/sessions', sessionId]);
  }

  startTour(): void {
    const url = this.router.url;
    const routeKey: TourRouteKey = url.includes('/gm/stage-manager/')
      ? 'stageManager'
      : url.includes('/combats/') && url.includes('/summary')
        ? 'combatSummary'
        : url.includes('/combats/new')
          ? 'combatSetup'
          : url.includes('/combats/')
            ? 'combatTracker'
            : url.includes('/rolls')
              ? 'rolls'
              : /^\/sessions\/[^/]+$/.test(url)
                ? 'dashboard'
                : 'sessions';

    this.tour.start(routeKey);
  }
}
