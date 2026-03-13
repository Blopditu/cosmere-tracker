import { Routes } from '@angular/router';
import { AnalyticsPageComponent } from './pages/analytics-page.component';
import { FightRecapPageComponent } from './pages/fight-recap-page.component';
import { FightTrackerPageComponent } from './pages/fight-tracker-page.component';
import { RosterPageComponent } from './pages/roster-page.component';
import { SessionDetailPageComponent } from './pages/session-detail-page.component';
import { SessionRecapPageComponent } from './pages/session-recap-page.component';
import { SessionsPageComponent } from './pages/sessions-page.component';
import { SettingsPageComponent } from './pages/settings-page.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'sessions',
  },
  {
    path: 'roster',
    component: RosterPageComponent,
  },
  {
    path: 'sessions',
    component: SessionsPageComponent,
  },
  {
    path: 'sessions/:sessionId',
    component: SessionDetailPageComponent,
  },
  {
    path: 'sessions/:sessionId/fights/:fightId',
    component: FightTrackerPageComponent,
  },
  {
    path: 'sessions/:sessionId/fights/:fightId/recap',
    component: FightRecapPageComponent,
  },
  {
    path: 'sessions/:sessionId/recap',
    component: SessionRecapPageComponent,
  },
  {
    path: 'analytics',
    component: AnalyticsPageComponent,
  },
  {
    path: 'settings',
    component: SettingsPageComponent,
  },
];
