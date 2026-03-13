import { Routes } from '@angular/router';
import { ShellLayoutComponent } from './core/shell-layout.component';
import { SessionListPageComponent } from './features/session/session-list-page.component';
import { SessionDashboardPageComponent } from './features/session/session-dashboard-page.component';
import { RollTrackerPageComponent } from './features/roll-tracker/roll-tracker-page.component';
import { CombatSetupPageComponent } from './features/combat-tracker/combat-setup-page.component';
import { CombatTrackerPageComponent } from './features/combat-tracker/combat-tracker-page.component';
import { PostCombatStatsPageComponent } from './features/post-combat-stats/post-combat-stats-page.component';
import { StageManagerPageComponent } from './features/stage-manager/stage-manager-page.component';
import { PlayerDisplayPageComponent } from './features/stage-manager/player-display-page.component';

export const routes: Routes = [
  {
    path: 'display/:sessionId',
    component: PlayerDisplayPageComponent,
  },
  {
    path: '',
    component: ShellLayoutComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'sessions',
      },
      {
        path: 'sessions',
        component: SessionListPageComponent,
      },
      {
        path: 'sessions/:sessionId',
        component: SessionDashboardPageComponent,
      },
      {
        path: 'sessions/:sessionId/rolls',
        component: RollTrackerPageComponent,
      },
      {
        path: 'sessions/:sessionId/combats/new',
        component: CombatSetupPageComponent,
      },
      {
        path: 'sessions/:sessionId/combats/:combatId',
        component: CombatTrackerPageComponent,
      },
      {
        path: 'sessions/:sessionId/combats/:combatId/summary',
        component: PostCombatStatsPageComponent,
      },
      {
        path: 'gm/stage-manager/:sessionId',
        component: StageManagerPageComponent,
      },
    ],
  },
];
