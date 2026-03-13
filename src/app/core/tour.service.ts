import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

export type TourRouteKey =
  | 'sessions'
  | 'dashboard'
  | 'rolls'
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
    description: 'The left rail is your GM workflow: sessions, dashboard, rolls, combat setup, and stage management.',
    selector: '[data-tour="module-nav"]',
    placement: 'right',
  },
];

const ROUTE_STEPS: Record<TourRouteKey, TourStep[]> = {
  sessions: [
    {
      title: 'Create the next session',
      description: 'Start here when you are prepping or opening a new table night. Add party members and enemy templates up front.',
      selector: '[data-tour="session-create"]',
    },
    {
      title: 'Open existing sessions',
      description: 'Use the session list to jump back into a previous night, delete a stale draft, or pick up an unfinished combat.',
      selector: '[data-tour="session-list"]',
      placement: 'left',
    },
  ],
  dashboard: [
    {
      title: 'Use the dashboard as your hub',
      description: 'These quick actions branch straight into rolls, combat, or stage display for the current session.',
      selector: '[data-tour="dashboard-actions"]',
      placement: 'bottom',
    },
    {
      title: 'Track the party at a glance',
      description: 'Keep the current cast visible here so you can confirm roles and focus baselines before things get hectic.',
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
      description: 'This form is for all session rolls, including out-of-combat checks and combat-linked attacks.',
      selector: '[data-tour="roll-form"]',
    },
    {
      title: 'Watch player luck over time',
      description: 'These analytics show volume, average raw d20s, nat 20s, nat 1s, and attack accuracy.',
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
  combatSetup: [
    {
      title: 'Build the encounter roster',
      description: 'This panel combines party members and enemy templates into the combat-ready participant list.',
      selector: '[data-tour="combat-setup-participants"]',
    },
    {
      title: 'Assign fast and slow turns',
      description: 'Round one assignments determine who gets 2 actions and who gets 3 actions at the start of the fight.',
      selector: '[data-tour="combat-setup-round"]',
      placement: 'left',
    },
  ],
  combatTracker: [
    {
      title: 'Monitor live participants',
      description: 'This sidebar keeps current HP and focus visible so you can update state without hunting around.',
      selector: '[data-tour="combat-participants"]',
    },
    {
      title: 'Follow the round structure',
      description: 'Turns are grouped by Fast PCs, Fast NPCs, Slow PCs, and Slow NPCs to match the Cosmere combat cadence.',
      selector: '[data-tour="combat-turn-groups"]',
      placement: 'left',
    },
    {
      title: 'Log actions from the selected turn',
      description: 'Use the quick logger for attacks, support actions, reactions, focus costs, and linked d20 rolls.',
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
      description: 'The left column is your running order. Select, duplicate, reorder, or delete scene entries here.',
      selector: '[data-tour="stage-scenes"]',
    },
    {
      title: 'Preview what you are editing',
      description: 'The middle preview is GM-only. It does not affect the player display until you explicitly publish.',
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
      description: 'This is the spoiler-safe trigger. Only Go live updates the player screen.',
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
      element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
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
