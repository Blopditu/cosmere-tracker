import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { SessionStoreService } from './session-store.service';
import { TourOverlayComponent } from './tour-overlay.component';
import { TourRouteKey, TourService } from './tour.service';
import { RosharIconComponent } from '../shared/roshar-icon.component';
import { AppRuntimeService } from './app-runtime.service';

@Component({
  selector: 'app-shell-layout',
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, RouterOutlet, TourOverlayComponent, RosharIconComponent],
  template: `
    <div class="app-shell">
      <header class="topbar war-header card engraved-panel shell-utility-bar">
        <div class="shell-identity">
          <div class="brand-mark compact-brand-mark">
            <span class="brand-sigil compact-brand-sigil">
              <app-roshar-icon key="dashboard" label="Command desk sigil" tone="gold" [size]="20" />
            </span>
            <div>
              <p class="eyebrow">Cosmere Tracker</p>
              <h1>GM command desk</h1>
            </div>
          </div>
          <div class="shell-status-bar">
            <span class="tag-chip">
              <app-roshar-icon key="chronicle" label="Save status" [tone]="saveTone()" [size]="14" />
              {{ saveLabel() }}
            </span>
            @if (runtime.lastError()) {
              <span class="tag-chip shell-error-chip">
                <app-roshar-icon key="damage" label="Latest error" tone="ruby" [size]="14" />
                {{ runtime.lastError() }}
              </span>
            }
            @if (currentSessionId() && runtime.liveSessionId() === currentSessionId()) {
              <span class="tag-chip live-chip">
                <app-roshar-icon key="live" label="Live scene" tone="emerald" [size]="14" />
                {{ runtime.liveSceneTitle() || 'Nothing live' }}
              </span>
            }
          </div>
        </div>

        <div class="topbar-actions shell-control-strip">
          <label class="compact-field" data-tour="session-switcher">
            <span>Active session</span>
            <select [ngModel]="currentSessionId()" (ngModelChange)="goToSession($event)">
              <option value="">Choose session</option>
              @for (session of store.sessions(); track session.id) {
                <option [value]="session.id">{{ session.title }}</option>
              }
            </select>
          </label>
          <a class="button-outline shell-shortcut" routerLink="/sessions">
            <app-roshar-icon key="sessions" label="Sessions" tone="gold" [size]="18" />
            <span>Sessions</span>
          </a>
          <button type="button" class="icon-button" data-tour="help-button" (click)="startTour()" aria-label="Open guided tour">
            <app-roshar-icon key="help" label="Open guided tour" tone="gold" [size]="18" />
          </button>
        </div>
      </header>

      <div class="shell-grid">
        <aside class="module-nav card engraved-panel" data-tour="module-nav">
          <div class="rail-heading">
            <p class="eyebrow">Navigate</p>
            <h2>Session rail</h2>
          </div>
          <a routerLink="/sessions" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
            <app-roshar-icon key="sessions" label="Session index" tone="gold" [size]="18" />
            <span>Sessions</span>
          </a>
          <a routerLink="/campaign/roster" routerLinkActive="active">
            <app-roshar-icon key="dashboard" label="Campaign roster" tone="topaz" [size]="18" />
            <span>Roster</span>
          </a>
          <a [routerLink]="sessionRoute()" routerLinkActive="active">
            <app-roshar-icon key="dashboard" label="Dashboard" tone="sapphire" [size]="18" />
            <span>Dashboard</span>
          </a>
          <a [routerLink]="rollRoute()" routerLinkActive="active">
            <app-roshar-icon key="rolls" label="Roll tracker" tone="topaz" [size]="18" />
            <span>Rolls</span>
          </a>
          <a [routerLink]="combatRoute()" routerLinkActive="active">
            <app-roshar-icon key="combat" label="Combat setup" tone="ruby" [size]="18" />
            <span>Combat</span>
          </a>
          <a [routerLink]="stageRoute()" routerLinkActive="active">
            <app-roshar-icon key="stage" label="Stage manager" tone="emerald" [size]="18" />
            <span>Stage</span>
          </a>
          <a [routerLink]="warRoomRoute" routerLinkActive="active">
            <app-roshar-icon key="chronicle" label="War room" tone="topaz" [size]="18" />
            <span>War Room</span>
          </a>
          <a routerLink="/gm/import/review" routerLinkActive="active">
            <app-roshar-icon key="aid" label="Import review" tone="sapphire" [size]="18" />
            <span>Imports</span>
          </a>
        </aside>

        <main class="shell-content war-content">
          <router-outlet />
        </main>
      </div>
    </div>

    <app-tour-overlay />
  `,
})
export class ShellLayoutComponent {
  readonly store = inject(SessionStoreService);
  readonly runtime = inject(AppRuntimeService);
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
    this.currentSessionId() ? ['/sessions', this.currentSessionId(), 'combats'] : ['/sessions'],
  );
  readonly stageRoute = computed(() =>
    this.currentSessionId() ? ['/gm/stage-manager', this.currentSessionId()] : ['/sessions'],
  );
  readonly warRoomRoute = ['/gm/campaigns', 'stonewalkers-campaign'];

  constructor() {
    const syncRoute = () => {
      let snapshot = this.activatedRoute.snapshot;
      while (snapshot.firstChild) {
        snapshot = snapshot.firstChild;
      }
      const sessionId = snapshot.paramMap.get('sessionId') ?? '';
      this.currentSessionId.set(sessionId);
      if (sessionId) {
        void this.store.refreshLiveScene(sessionId);
      } else {
        this.runtime.resetLiveScene(null, null);
      }
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
      : url.includes('/campaign/roster')
        ? 'campaignRoster'
      : /^\/sessions\/[^/]+\/combats$/.test(url)
        ? 'combatQueue'
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

  saveLabel(): string {
    switch (this.runtime.mutationState()) {
      case 'saving':
        return 'Saving changes';
      case 'saved':
        return this.runtime.lastSavedAt() ? `Saved ${new Date(this.runtime.lastSavedAt()!).toLocaleTimeString()}` : 'Saved';
      case 'error':
        return 'Save failed';
      default:
        return 'Ready';
    }
  }

  saveTone() {
    switch (this.runtime.mutationState()) {
      case 'saving':
        return 'topaz';
      case 'saved':
        return 'emerald';
      case 'error':
        return 'ruby';
      default:
        return 'muted';
    }
  }
}
