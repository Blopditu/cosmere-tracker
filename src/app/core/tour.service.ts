import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

export type TourRouteKey =
  | 'sessions'
  | 'campaignRoster'
  | 'dashboard'
  | 'rolls'
  | 'combatQueue'
  | 'combatSetup'
  | 'combatTracker'
  | 'combatSummary'
  | 'stageManager';

export interface TourStep {
  title: string;
  description: string;
  selector: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const BASE_STEPS: TourStep[] = [
  {
    title: 'Need a refresher?',
    description: 'Use this help icon at any time to restart the guided walkthrough for the page you are on.',
    selector: '[data-tour="help-button"]',
    placement: 'bottom',
  },
  {
    title: 'Switch sessions fast',
    description: 'Change the active session here to jump between campaigns without losing your place in the rest of the shell.',
    selector: '[data-tour="session-switcher"]',
    placement: 'bottom',
  },
  {
    title: 'Move between modules',
    description: 'The session rail keeps the main GM destinations one click away without dominating the page itself.',
    selector: '[data-tour="module-nav"]',
    placement: 'right',
  },
];

const ROUTE_STEPS: Record<TourRouteKey, TourStep[]> = {
  sessions: [
    {
      title: 'Create the next session',
      description: 'Forge the next session here with party seeds, enemy reserve entries, and enough notes to open the night cleanly.',
      selector: '[data-tour="session-create"]',
    },
    {
      title: 'Open existing sessions',
      description: 'The ledger keeps every campaign record close at hand for reopening, exporting, or clearing stale drafts.',
      selector: '[data-tour="session-list"]',
      placement: 'left',
    },
  ],
  campaignRoster: [
    {
      title: 'Manage the campaign roster',
      description: 'This module owns the persistent players and enemy templates shared across the whole campaign.',
      selector: '[data-tour="campaign-roster"]',
    },
    {
      title: 'Add recurring players here',
      description: 'Players live at campaign level now. Add or edit them here once, then include them in specific sessions from the dashboard.',
      selector: '[data-tour="campaign-players"]',
    },
    {
      title: 'Build reusable enemy templates',
      description: 'Enemy templates also live here so combats can clone them into encounters without retyping their baseline stats or sheet image.',
      selector: '[data-tour="campaign-enemies"]',
      placement: 'top',
    },
  ],
  dashboard: [
    {
      title: 'Use the dashboard as your hub',
      description: 'Use these command links to jump into rolls, a new combat, or the stage console for the active session.',
      selector: '[data-tour="dashboard-actions"]',
      placement: 'bottom',
    },
    {
      title: 'Switch between party and enemies',
      description: 'The session dashboard now focuses on who is actually present. Use it to mark which campaign players are in this specific session.',
      selector: '[data-tour="dashboard-roster"]',
      placement: 'bottom',
    },
    {
      title: 'Track the party at a glance',
      description: 'Keep the current cast visible here so roles and focus baselines stay readable before the table gets noisy.',
      selector: '[data-tour="dashboard-party"]',
    },
    {
      title: 'Resume the latest encounter',
      description: 'Recent combats are listed here so you can reopen an active fight instead of rebuilding it.',
      selector: '[data-tour="dashboard-combats"]',
      placement: 'top',
    },
  ],
  rolls: [
    {
      title: 'Log every d20 quickly',
      description: 'This quick log is for every session d20, whether it came from combat, exploration, or a quick table ruling.',
      selector: '[data-tour="roll-form"]',
    },
    {
      title: 'Open advanced context only when needed',
      description: 'Keep the quick log dense during play, and expand the advanced section only for advantage notes or extra context.',
      selector: '[data-tour="roll-advanced"]',
      placement: 'bottom',
    },
    {
      title: 'Watch player luck over time',
      description: 'The analytics stay secondary to the ledger, but they still show luck swings, nat spikes, and attack accuracy.',
      selector: '[data-tour="roll-analytics"]',
      placement: 'left',
    },
    {
      title: 'Review the live timeline',
      description: 'Recent history helps you verify what just happened before moving on to the next scene or turn.',
      selector: '[data-tour="roll-history"]',
      placement: 'top',
    },
  ],
  combatQueue: [
    {
      title: 'Queue prepared encounters',
      description: 'This queue keeps planned, active, and finished combats separated so you can prepare several encounters in advance.',
      selector: '[data-tour="combat-queue"]',
    },
  ],
  combatSetup: [
    {
      title: 'Build the encounter roster',
      description: 'Use the encounter builder to combine the party with enemy reserve copies and tune starting HP, focus, and names.',
      selector: '[data-tour="combat-setup-participants"]',
    },
    {
      title: 'Assign fast and slow tempo inline',
      description: 'Set each participant to Fast or Slow directly in the roster instead of juggling separate multi-select lists.',
      selector: '[data-tour="combat-setup-round"]',
      placement: 'left',
    },
  ],
  combatTracker: [
    {
      title: 'Monitor live participants',
      description: 'The unit ledger keeps HP and focus close so you can update state without leaving the tactical board.',
      selector: '[data-tour="combat-participants"]',
    },
    {
      title: 'Follow the round structure',
      description: 'The tactical board groups Fast PCs, Fast NPCs, Slow PCs, and Slow NPCs to match the Cosmere combat cadence.',
      selector: '[data-tour="combat-turn-groups"]',
      placement: 'left',
    },
    {
      title: 'Log actions from the selected turn',
      description: 'The command slab is the live turn console for attacks, support actions, reactions, focus costs, and linked d20s.',
      selector: '[data-tour="combat-action-logger"]',
      placement: 'left',
    },
    {
      title: 'Keep the event feed readable',
      description: 'The feed summarizes what just happened so you can narrate consequences and verify action order.',
      selector: '[data-tour="combat-feed"]',
      placement: 'top',
    },
  ],
  combatSummary: [
    {
      title: 'Read the scoreboard',
      description: 'This table is your post-match recap: damage, hit rate, crits, focus spend, and support contribution.',
      selector: '[data-tour="combat-summary-table"]',
    },
    {
      title: 'Inspect the full log',
      description: 'Use the detailed log to reconstruct turns after the fight or settle rules questions after the session.',
      selector: '[data-tour="combat-summary-log"]',
      placement: 'top',
    },
  ],
  stageManager: [
    {
      title: 'Organize your scenes',
      description: 'The cue ledger is your running order. Select, duplicate, reorder, or remove scene entries here.',
      selector: '[data-tour="stage-scenes"]',
    },
    {
      title: 'Preview what you are editing',
      description: 'The middle preview is GM-only. It does not affect the player display until you explicitly go live.',
      selector: '[data-tour="stage-preview"]',
      placement: 'left',
    },
    {
      title: 'Edit safely on the right',
      description: 'Upload a background, store a YouTube reference, and keep private GM notes without leaking them to players.',
      selector: '[data-tour="stage-editor"]',
      placement: 'left',
    },
    {
      title: 'Publish only when ready',
      description: 'This is the spoiler-safe trigger. Draft edits stay private until you deliberately publish them.',
      selector: '[data-tour="stage-publish"]',
      placement: 'bottom',
    },
  ],
};

@Injectable({
  providedIn: 'root',
})
export class TourService {
  private readonly document = inject(DOCUMENT);
  readonly isOpen = signal(false);
  readonly steps = signal<TourStep[]>([]);
  readonly activeIndex = signal(0);
  readonly spotlightRect = signal<SpotlightRect | null>(null);
  readonly currentStep = computed(() => this.steps()[this.activeIndex()] ?? null);
  readonly stepLabel = computed(() =>
    this.steps().length ? `${this.activeIndex() + 1} / ${this.steps().length}` : '0 / 0',
  );

  start(routeKey: TourRouteKey): void {
    const steps = [...BASE_STEPS, ...ROUTE_STEPS[routeKey]].filter((step) =>
      Boolean(this.document.querySelector(step.selector)),
    );
    if (!steps.length) {
      return;
    }
    this.steps.set(steps);
    this.activeIndex.set(0);
    this.isOpen.set(true);
    this.refresh(true);
  }

  close(): void {
    this.isOpen.set(false);
    this.steps.set([]);
    this.activeIndex.set(0);
    this.spotlightRect.set(null);
  }

  next(): void {
    if (this.activeIndex() >= this.steps().length - 1) {
      this.close();
      return;
    }
    this.activeIndex.update((index) => index + 1);
    this.refresh(true);
  }

  previous(): void {
    if (this.activeIndex() === 0) {
      return;
    }
    this.activeIndex.update((index) => index - 1);
    this.refresh(true);
  }

  refresh(shouldScroll = false): void {
    if (!this.isOpen()) {
      return;
    }
    const currentStep = this.currentStep();
    if (!currentStep) {
      this.close();
      return;
    }

    const element = this.document.querySelector(currentStep.selector) as HTMLElement | null;
    if (!element) {
      this.close();
      return;
    }

    if (shouldScroll) {
      const viewportHeight = this.document.defaultView?.innerHeight ?? 0;
      const viewportWidth = this.document.defaultView?.innerWidth ?? 0;
      const currentRect = element.getBoundingClientRect();
      const outOfView =
        currentRect.top < 24 ||
        currentRect.left < 24 ||
        currentRect.bottom > viewportHeight - 24 ||
        currentRect.right > viewportWidth - 24;
      if (outOfView) {
        element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
      }
    }
    const rect = element.getBoundingClientRect();
    const padding = 10;
    this.spotlightRect.set({
      top: Math.max(8, rect.top - padding),
      left: Math.max(8, rect.left - padding),
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });
  }
}
