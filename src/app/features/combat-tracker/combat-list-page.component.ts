import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CombatRecord } from '@shared/domain';
import { CombatStore } from './combat.store';
import { RosharIconComponent } from '../../shared/roshar-icon.component';

@Component({
  selector: 'app-combat-list-page',
  imports: [CommonModule, RouterLink, RosharIconComponent],
  template: `
    <section class="page-header combat-queue-header card engraved-panel">
      <div class="route-heading">
        <p class="eyebrow">Combat queue</p>
        <h2>Prepared encounters</h2>
        <p>Prepare multiple encounters for the session, keep them in a planned state, and start the next one only when the table reaches it.</p>
      </div>
      <div class="encounter-header-summary">
        <article class="route-stat topaz">
          <app-roshar-icon key="combat" label="Prepared combats" tone="topaz" [size]="18" />
          <span class="eyebrow">Prepared</span>
          <strong>{{ plannedCombats().length }}</strong>
        </article>
        <article class="route-stat ruby">
          <app-roshar-icon key="live" label="Active combats" tone="ruby" [size]="18" />
          <span class="eyebrow">Active</span>
          <strong>{{ activeCombats().length }}</strong>
        </article>
        <article class="route-stat sapphire">
          <app-roshar-icon key="chronicle" label="Finished combats" tone="sapphire" [size]="18" />
          <span class="eyebrow">Finished</span>
          <strong>{{ finishedCombats().length }}</strong>
        </article>
      </div>
    </section>

    <div class="button-row combat-queue-actions">
      <a class="shell-shortcut" [routerLink]="['/sessions', sessionId(), 'combats', 'new']">
        <app-roshar-icon key="combat" label="Prepare combat" tone="gold" [size]="16" />
        <span>Prepare combat</span>
      </a>
      <a class="button-outline shell-shortcut" [routerLink]="['/sessions', sessionId()]">
        <app-roshar-icon key="dashboard" label="Back to session" tone="sapphire" [size]="16" />
        <span>Session dashboard</span>
      </a>
    </div>

    <div class="layout-columns combat-queue-columns" data-tour="combat-queue">
      <section class="card engraved-panel">
        <div class="card-header">
          <h3>Prepared</h3>
          <span class="pill">{{ plannedCombats().length }}</span>
        </div>
        <div class="list-stack">
          @for (combat of plannedCombats(); track combat.id) {
            <article class="list-card ledger-row combat-queue-row">
              <div>
                <h3>{{ combat.title }}</h3>
                <p>{{ combat.participants.length }} participants • round {{ combat.currentRoundNumber || 1 }}</p>
                <small>{{ combat.notes || 'Prepared and waiting to begin.' }}</small>
              </div>
              <div class="button-row">
                <a class="button-outline shell-shortcut" [routerLink]="['/sessions', sessionId(), 'combats', combat.id]">
                  <app-roshar-icon key="combat" label="Open prepared combat" tone="topaz" [size]="16" />
                  <span>Open</span>
                </a>
                <button type="button" class="shell-shortcut" (click)="startCombat(combat)">
                  <app-roshar-icon key="live" label="Start combat" tone="ruby" [size]="16" />
                  <span>Start</span>
                </button>
              </div>
            </article>
          } @empty {
            <article class="empty-card">No prepared combats yet. Build encounters here ahead of time, then start them when the table reaches them.</article>
          }
        </div>
      </section>

      <section class="card engraved-panel">
        <div class="card-header">
          <h3>Active</h3>
          <span class="pill">{{ activeCombats().length }}</span>
        </div>
        <div class="list-stack">
          @for (combat of activeCombats(); track combat.id) {
            <article class="list-card ledger-row combat-queue-row">
              <div>
                <h3>{{ combat.title }}</h3>
                <p>Round {{ combat.currentRoundNumber || 1 }} • {{ combat.participants.length }} participants</p>
                <small>Encounter is currently live.</small>
              </div>
              <a class="shell-shortcut" [routerLink]="['/sessions', sessionId(), 'combats', combat.id]">
                <app-roshar-icon key="combat" label="Resume combat" tone="ruby" [size]="16" />
                <span>Resume</span>
              </a>
            </article>
          } @empty {
            <article class="empty-card">No active combat right now.</article>
          }
        </div>
      </section>

      <section class="card engraved-panel">
        <div class="card-header">
          <h3>Finished</h3>
          <span class="pill">{{ finishedCombats().length }}</span>
        </div>
        <div class="list-stack">
          @for (combat of finishedCombats(); track combat.id) {
            <article class="list-card ledger-row combat-queue-row">
              <div>
                <h3>{{ combat.title }}</h3>
                <p>{{ combat.participants.length }} participants • ended</p>
                <small>{{ combat.notes || 'Review the war report or reopen the log.' }}</small>
              </div>
              <div class="button-row">
                <a class="button-outline shell-shortcut" [routerLink]="['/sessions', sessionId(), 'combats', combat.id]">
                  <app-roshar-icon key="combat" label="Open combat log" tone="sapphire" [size]="16" />
                  <span>Open</span>
                </a>
                <a class="button-outline shell-shortcut" [routerLink]="['/sessions', sessionId(), 'combats', combat.id, 'summary']">
                  <app-roshar-icon key="chronicle" label="Open summary" tone="topaz" [size]="16" />
                  <span>Summary</span>
                </a>
              </div>
            </article>
          } @empty {
            <article class="empty-card">No finished combats yet.</article>
          }
        </div>
      </section>
    </div>
  `,
})
export class CombatListPageComponent {
  readonly store = inject(CombatStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly sessionId = signal('');

  readonly plannedCombats = computed(() => this.store.combats().filter((combat) => combat.status === 'planned'));
  readonly activeCombats = computed(() => this.store.combats().filter((combat) => combat.status === 'active'));
  readonly finishedCombats = computed(() => this.store.combats().filter((combat) => combat.status === 'finished'));

  constructor() {
    const sub = this.route.paramMap.subscribe((params) => {
      const sessionId = params.get('sessionId');
      if (!sessionId) {
        return;
      }
      this.sessionId.set(sessionId);
      void this.store.loadForSession(sessionId);
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  async startCombat(combat: CombatRecord): Promise<void> {
    await this.store.startCombat(combat.id);
    await this.router.navigate(['/sessions', this.sessionId(), 'combats', combat.id]);
  }
}
