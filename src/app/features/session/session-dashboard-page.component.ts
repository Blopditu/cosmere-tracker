import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ParticipantTemplate, PartyMember, SessionAnalytics, SessionDashboard } from '@shared/domain';
import { SessionStoreService } from '../../core/session-store.service';
import { RosharIconComponent } from '../../shared/roshar-icon.component';
import { CombatStore } from '../combat-tracker/combat.store';

@Component({
  selector: 'app-session-dashboard-page',
  imports: [CommonModule, FormsModule, RouterLink, RosharIconComponent],
  template: `
    @if (dashboard()) {
      <section class="page-header session-dashboard-header card engraved-panel">
        <div class="route-heading">
          <p class="eyebrow">Session dashboard</p>
          <h2>{{ dashboard()!.session.title }}</h2>
          <p>{{ dashboard()!.session.notes || 'Session hub for roster, rolls, combat, and stage cues.' }}</p>
        </div>
        <div class="dashboard-command-links" data-tour="dashboard-actions">
          <div class="button-row">
            <a [routerLink]="['/sessions', dashboard()!.session.id, 'rolls']">Rolls</a>
            <a [routerLink]="['/sessions', dashboard()!.session.id, 'combats']" class="button-outline">Combat queue</a>
            <a [routerLink]="['/sessions', dashboard()!.session.id, 'combats', 'new']" class="button-outline">Prepare combat</a>
            <a [routerLink]="['/gm/stage-manager', dashboard()!.session.id]" class="button-outline">Stage</a>
          </div>
          <div class="session-command-chips">
            <span class="tag-chip">
              <app-roshar-icon key="sessions" label="Party count" tone="sapphire" [size]="14" />
              {{ dashboard()!.session.partyMembers.length }} in session
            </span>
            <span class="tag-chip">
              <app-roshar-icon key="combat" label="Combat count" tone="ruby" [size]="14" />
              {{ dashboard()!.session.combatCount }} combats
            </span>
            <span class="tag-chip">
              <app-roshar-icon key="stage" label="Stage scenes" tone="emerald" [size]="14" />
              {{ dashboard()!.session.stageSceneCount }} scenes
            </span>
            <span class="tag-chip">
              <app-roshar-icon key="combat" label="Enemy templates" tone="ruby" [size]="14" />
              {{ dashboard()!.participantTemplates.length }} enemy templates
            </span>
          </div>
        </div>
      </section>

      <section class="session-pulse-grid">
        <article class="card stat-card gemstone-stat sapphire">
          <app-roshar-icon key="sessions" label="Party members" tone="sapphire" [size]="20" />
          <span class="stat-label">Session players</span>
          <strong>{{ dashboard()!.session.partyMembers.length }}</strong>
        </article>
        <article class="card stat-card gemstone-stat topaz">
          <app-roshar-icon key="rolls" label="Rolls logged" tone="topaz" [size]="20" />
          <span class="stat-label">Rolls logged</span>
          <strong>{{ dashboard()!.session.rollCount }}</strong>
        </article>
        <article class="card stat-card gemstone-stat ruby">
          <app-roshar-icon key="combat" label="Combats" tone="ruby" [size]="20" />
          <span class="stat-label">Combats</span>
          <strong>{{ dashboard()!.session.combatCount }}</strong>
        </article>
        <article class="card stat-card gemstone-stat emerald">
          <app-roshar-icon key="stage" label="Stage scenes" tone="emerald" [size]="20" />
          <span class="stat-label">Stage scenes</span>
          <strong>{{ dashboard()!.session.stageSceneCount }}</strong>
        </article>
      </section>

      @if (analytics()) {
        <section class="card engraved-panel dashboard-recap session-pulse-panel">
          <div class="card-header">
            <div class="section-heading">
              <app-roshar-icon key="chronicle" label="Session pulse" tone="topaz" [size]="18" />
              <h3>Session pulse</h3>
            </div>
            <span class="pill">{{ analytics()!.totalCombats }} combats tracked</span>
          </div>
          <div class="stats-grid summary-highlights">
            <article class="stat-card gemstone-stat ruby">
              <span class="stat-label">Damage dealt</span>
              <strong>{{ analytics()!.totalDamageDealt }}</strong>
              <small>{{ analytics()!.awards.mostDamageDealt || 'None' }} led</small>
            </article>
            <article class="stat-card gemstone-stat sapphire">
              <span class="stat-label">Average d20</span>
              <strong>{{ analytics()!.averageRawD20 | number: '1.1-1' }}</strong>
              <small>{{ analytics()!.awards.mostAccurate || 'None' }} most accurate</small>
            </article>
            <article class="stat-card gemstone-stat topaz">
              <span class="stat-label">Focus spent</span>
              <strong>{{ analytics()!.totalFocusSpent }}</strong>
              <small>{{ analytics()!.awards.focusPressureLeader || 'None' }} spent the most</small>
            </article>
            <article class="stat-card gemstone-stat emerald">
              <span class="stat-label">Biggest hit</span>
              <strong>{{ analytics()!.awards.biggestHit || 'None' }}</strong>
              <small>{{ analytics()!.nat20Count }} nat 20s / {{ analytics()!.nat1Count }} nat 1s</small>
            </article>
          </div>
          <div class="table-wrap">
            <table class="summary-table">
              <thead>
                <tr>
                  <th>Actor</th>
                  <th>Damage dealt</th>
                  <th>Damage taken</th>
                  <th>Hit rate</th>
                  <th>Focus</th>
                  <th>Support</th>
                </tr>
              </thead>
              <tbody>
                @for (row of analytics()!.partyPerformance.slice(0, 6); track row.actorName) {
                  <tr>
                    <td>{{ row.actorName }}</td>
                    <td>{{ row.totalDamageDealt }}</td>
                    <td>{{ row.totalDamageTaken }}</td>
                    <td>{{ row.hitRate | percent: '1.0-0' }}</td>
                    <td>{{ row.focusSpent }}</td>
                    <td>{{ row.supportActionsUsed }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }

      <div class="layout-columns dashboard-overview-columns">
        <section class="card engraved-panel roster-management" data-tour="dashboard-roster">
          <div class="card-header">
            <div class="section-heading">
              <app-roshar-icon key="sessions" label="Roster management" tone="gold" [size]="18" />
              <h3>Roster management</h3>
            </div>
            <div class="button-row">
              <a class="button-outline shell-shortcut" routerLink="/campaign/roster">
                <app-roshar-icon key="dashboard" label="Open campaign roster" tone="topaz" [size]="16" />
                <span>Campaign roster</span>
              </a>
              <button type="button" class="shell-shortcut" (click)="saveRoster()">
                <app-roshar-icon key="aid" label="Save session cast" tone="gold" [size]="16" />
                <span>Save session cast</span>
              </button>
            </div>
          </div>

          <div class="roster-view-toggle">
            <button type="button" class="button-outline micro-button" [class.active]="rosterView() === 'party'" (click)="rosterView.set('party')">Party</button>
            <button type="button" class="button-outline micro-button" [class.active]="rosterView() === 'enemy'" (click)="rosterView.set('enemy')">Enemies</button>
          </div>

          @if (rosterView() === 'party') {
            <section class="inset-panel">
              <div class="card-header">
                <div class="section-heading">
                  <app-roshar-icon key="sessions" label="Campaign players" tone="sapphire" [size]="18" />
                  <h3>Campaign players</h3>
                </div>
                <button type="button" class="button-outline shell-shortcut" (click)="addPartyMember()">
                  <app-roshar-icon key="aid" label="Add player" tone="sapphire" [size]="16" />
                  <span>Add player</span>
                </button>
              </div>
              <p class="muted roster-helper-copy">Players are campaign-level characters. Toggle who appears in this session, then save once for the whole roster.</p>
              <div class="roster-editor-list">
                @for (member of partyDraft(); track member.id) {
                  <article class="roster-editor-row party-roster-row">
                    <input [(ngModel)]="member.name" [ngModelOptions]="{ standalone: true }" type="text" placeholder="Name" />
                    <input [(ngModel)]="member.role" [ngModelOptions]="{ standalone: true }" type="text" placeholder="Role" />
                    <input [(ngModel)]="member.maxHealth" [ngModelOptions]="{ standalone: true }" type="number" min="0" placeholder="HP" />
                    <input [(ngModel)]="member.maxFocus" [ngModelOptions]="{ standalone: true }" type="number" min="0" placeholder="Focus" />
                    <button type="button" class="button-outline micro-button" [class.active]="sessionPlayerIdsDraft().includes(member.id)" (click)="toggleSessionPlayer(member.id)">
                      {{ sessionPlayerIdsDraft().includes(member.id) ? 'In session' : 'Bench' }}
                    </button>
                    <button type="button" class="button-outline button-danger micro-button" (click)="confirmRosterRemoval('party', member.id, member.name)">Remove</button>
                  </article>
                }
              </div>
            </section>
          } @else {
            <section class="inset-panel">
              <div class="card-header">
                <div class="section-heading">
                  <app-roshar-icon key="combat" label="Enemy templates" tone="ruby" [size]="18" />
                  <h3>Enemy templates</h3>
                </div>
                <button type="button" class="button-outline shell-shortcut" (click)="addEnemyTemplate()">
                  <app-roshar-icon key="aid" label="Add enemy template" tone="ruby" [size]="16" />
                  <span>Add enemy</span>
                </button>
              </div>
              <div class="roster-editor-list">
                @for (enemy of enemyDraft(); track enemy.id) {
                  <article class="roster-editor-row enemy-template-row">
                    <input [(ngModel)]="enemy.name" [ngModelOptions]="{ standalone: true }" type="text" placeholder="Enemy name" />
                    <input [(ngModel)]="enemy.role" [ngModelOptions]="{ standalone: true }" type="text" placeholder="Role" />
                    <input [(ngModel)]="enemy.maxHealth" [ngModelOptions]="{ standalone: true }" type="number" min="0" placeholder="HP" />
                    <input [(ngModel)]="enemy.maxFocus" [ngModelOptions]="{ standalone: true }" type="number" min="0" placeholder="Focus" />
                    <div class="enemy-sheet-cell">
                      @if (enemy.imagePath) {
                        <button type="button" class="enemy-sheet-thumb" [style.background-image]="'url(' + enemy.imagePath + ')'" (click)="openSheet(enemy.imagePath)"></button>
                      } @else {
                        <span class="tag-chip">No sheet</span>
                      }
                      <label class="button-outline micro-button file-trigger">
                        <span>{{ uploadingEnemyId() === enemy.id ? 'Uploading...' : 'Upload sheet' }}</span>
                        <input type="file" accept="image/*" (change)="uploadEnemySheet(enemy.id, $event)" />
                      </label>
                      @if (enemy.imagePath) {
                        <button type="button" class="button-outline micro-button" (click)="openSheet(enemy.imagePath)">Open</button>
                      }
                    </div>
                    <button type="button" class="button-outline button-danger micro-button" (click)="confirmRosterRemoval('enemy', enemy.id, enemy.name)">Remove</button>
                  </article>
                }
              </div>
              @if (uploadError()) {
                <p class="import-message">{{ uploadError() }}</p>
              }
            </section>
          }
        </section>

        <section class="dashboard-stream">
          <section class="card engraved-panel" data-tour="dashboard-party">
            <div class="card-header">
              <h3>Party overview</h3>
              <span class="pill">Session cast</span>
            </div>
            <div class="list-stack">
              @for (member of dashboard()!.session.partyMembers; track member.id) {
                <article class="list-card ledger-row">
                  <div>
                    <h3>{{ member.name }}</h3>
                    <p>{{ member.role || 'No role set' }}</p>
                  </div>
                  <div class="ledger-meta">
                    <span class="tag-chip">
                      <app-roshar-icon key="focus" label="Focus" tone="topaz" [size]="14" />
                      {{ member.maxFocus ?? 0 }} focus
                    </span>
                  </div>
                </article>
              } @empty {
                <article class="empty-card">No players are assigned to this session yet. Mark campaign characters as “In session” in the roster editor, then save the roster.</article>
              }
            </div>
          </section>

          <div class="layout-columns dashboard-stream-columns">
            <section class="card engraved-panel">
              <div class="card-header">
                <h3>Recent rolls</h3>
                <span class="pill">{{ dashboard()!.recentRolls.length }}</span>
              </div>
              <div class="list-stack">
                @for (roll of dashboard()!.recentRolls; track roll.id) {
                  <article class="timeline-item">
                    <strong class="event-line">
                      <app-roshar-icon key="rolls" label="Recent roll" tone="topaz" [size]="16" />
                      {{ roll.actorName || roll.actorId || 'Unknown' }}
                    </strong>
                    <p>{{ roll.rollCategory }} • d20 {{ roll.rawD20 }} + {{ roll.modifier }} = {{ roll.total }}</p>
                  </article>
                } @empty {
                  <article class="empty-card">No rolls logged yet. Open the roll ledger to start the session chronicle.</article>
                }
              </div>
            </section>

            <section class="card engraved-panel" data-tour="dashboard-combats">
              <div class="card-header">
                <h3>Recent combats</h3>
                <span class="pill">{{ dashboard()!.recentCombats.length }}</span>
              </div>
              <div class="list-stack">
                @for (combat of dashboard()!.recentCombats; track combat.id) {
                  <article class="list-card ledger-row">
                    <div>
                      <h3>{{ combat.title }}</h3>
                      <p>{{ combat.status }} • round {{ combat.currentRoundNumber || 0 }}</p>
                    </div>
                    <div class="button-row">
                      <a class="button-outline shell-shortcut" [routerLink]="['/sessions', dashboard()!.session.id, 'combats', combat.id]">
                        <app-roshar-icon key="combat" label="Open combat" tone="ruby" [size]="16" />
                        <span>Open</span>
                      </a>
                      @if (combat.status === 'planned') {
                        <button type="button" class="shell-shortcut" (click)="startPreparedCombat(combat.id)">
                          <app-roshar-icon key="live" label="Start combat" tone="topaz" [size]="16" />
                          <span>Start</span>
                        </button>
                      }
                    </div>
                  </article>
                } @empty {
                  <article class="empty-card">No combats recorded yet. Prepare several encounters in the combat queue, then start the right one when the table reaches it.</article>
                }
              </div>
            </section>
          </div>
        </section>
      </div>
    } @else {
      <section class="card empty-card">Loading session dashboard...</section>
    }

    @if (pendingRemoval()) {
      <div class="confirm-modal-backdrop" (click)="cancelRosterRemoval()"></div>
      <section class="confirm-modal card engraved-panel" role="dialog" aria-modal="true" aria-labelledby="roster-delete-title">
        <div class="card-header">
          <div class="section-heading">
            <app-roshar-icon key="damage" label="Delete roster entry" tone="ruby" [size]="18" />
            <h3 id="roster-delete-title">Delete roster entry?</h3>
          </div>
        </div>
        <p>
          Remove
          <strong>{{ pendingRemoval()!.label || (pendingRemoval()!.type === 'party' ? 'this player' : 'this enemy template') }}</strong>
          from the campaign roster?
        </p>
        <p class="muted">This only changes the draft in the dashboard until you save the roster, but once saved it removes the entry from the campaign-wide roster.</p>
        <div class="button-row">
          <button type="button" class="button-outline" (click)="cancelRosterRemoval()">Cancel</button>
          <button type="button" class="button-danger" (click)="confirmPendingRemoval()">Delete</button>
        </div>
      </section>
    }
  `,
})
export class SessionDashboardPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly sessionStore = inject(SessionStoreService);
  private readonly combatStore = inject(CombatStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly sessionId = signal('');
  readonly dashboard = signal<SessionDashboard | null>(null);
  readonly analytics = signal<SessionAnalytics | null>(null);
  readonly partyDraft = signal<PartyMember[]>([]);
  readonly enemyDraft = signal<ParticipantTemplate[]>([]);
  readonly sessionPlayerIdsDraft = signal<string[]>([]);
  readonly rosterView = signal<'party' | 'enemy'>('party');
  readonly uploadingEnemyId = signal('');
  readonly uploadError = signal('');
  readonly pendingRemoval = signal<{ type: 'party' | 'enemy'; id: string; label: string } | null>(null);

  constructor() {
    const sub = this.route.paramMap.subscribe((params) => {
      const sessionId = params.get('sessionId');
      if (sessionId) {
        this.sessionId.set(sessionId);
        void this.load(sessionId);
      }
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  private async load(sessionId: string): Promise<void> {
    const [dashboard, analytics] = await Promise.all([
      this.sessionStore.getDashboard(sessionId),
      this.sessionStore.getAnalytics(sessionId),
    ]);
    this.dashboard.set(dashboard);
    this.analytics.set(analytics);
    this.partyDraft.set(dashboard.campaignPartyMembers.map((member) => ({ ...member })));
    this.enemyDraft.set(dashboard.participantTemplates.map((enemy) => ({ ...enemy })));
    this.sessionPlayerIdsDraft.set([...dashboard.session.playerIds]);
  }

  addPartyMember(): void {
    const id = crypto.randomUUID();
    this.partyDraft.update((items) => [
      ...items,
      {
        id,
        name: '',
        side: 'pc',
        role: '',
        maxHealth: undefined,
        maxFocus: undefined,
      },
    ]);
    this.sessionPlayerIdsDraft.update((items) => [...items, id]);
  }

  removePartyMember(id: string): void {
    this.partyDraft.update((items) => items.filter((member) => member.id !== id));
    this.sessionPlayerIdsDraft.update((items) => items.filter((entry) => entry !== id));
  }

  addEnemyTemplate(): void {
    this.enemyDraft.update((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        name: '',
        side: 'enemy',
        role: '',
        maxHealth: undefined,
        maxFocus: undefined,
      },
    ]);
  }

  removeEnemyTemplate(id: string): void {
    this.enemyDraft.update((items) => items.filter((enemy) => enemy.id !== id));
  }

  confirmRosterRemoval(type: 'party' | 'enemy', id: string, label: string | undefined): void {
    this.pendingRemoval.set({ type, id, label: label?.trim() || '' });
  }

  cancelRosterRemoval(): void {
    this.pendingRemoval.set(null);
  }

  confirmPendingRemoval(): void {
    const pending = this.pendingRemoval();
    if (!pending) {
      return;
    }
    if (pending.type === 'party') {
      this.removePartyMember(pending.id);
    } else {
      this.removeEnemyTemplate(pending.id);
    }
    this.pendingRemoval.set(null);
  }

  async uploadEnemySheet(enemyId: string, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.uploadingEnemyId.set(enemyId);
    this.uploadError.set('');
    try {
      const imagePath = await this.sessionStore.uploadEnemySheet(this.sessionId(), file);
      this.enemyDraft.update((items) =>
        items.map((enemy) => (enemy.id === enemyId ? { ...enemy, imagePath } : enemy)),
      );
    } catch (error) {
      this.uploadError.set(error instanceof Error ? error.message : 'Enemy sheet upload failed.');
    } finally {
      this.uploadingEnemyId.set('');
      input.value = '';
    }
  }

  openSheet(imagePath: string | undefined): void {
    if (!imagePath) {
      return;
    }
    window.open(imagePath, '_blank', 'noopener,noreferrer');
  }

  async saveRoster(): Promise<void> {
    const normalizedParty = this.partyDraft()
      .map((member) => this.normalizeRosterEntry(member, 'pc'))
      .filter((member): member is PartyMember => Boolean(member));
    const normalizedEnemies = this.enemyDraft()
      .map((enemy) => this.normalizeRosterEntry(enemy, 'enemy'))
      .filter((enemy): enemy is ParticipantTemplate => Boolean(enemy));

    await this.sessionStore.updateSession(this.sessionId(), {
      playerIds: this.sessionPlayerIdsDraft().filter((playerId) => normalizedParty.some((member) => member.id === playerId)),
      partyMembers: normalizedParty,
      participantTemplates: normalizedEnemies,
    });
    await this.load(this.sessionId());
  }

  toggleSessionPlayer(playerId: string): void {
    this.sessionPlayerIdsDraft.update((items) =>
      items.includes(playerId) ? items.filter((entry) => entry !== playerId) : [...items, playerId],
    );
  }

  async startPreparedCombat(combatId: string): Promise<void> {
    await this.combatStore.startCombat(combatId);
    await this.router.navigate(['/sessions', this.sessionId(), 'combats', combatId]);
  }

  private normalizeRosterEntry<T extends PartyMember | ParticipantTemplate>(
    entry: T,
    side: 'pc' | 'enemy',
  ): T | null {
    const name = entry.name.trim();
    if (!name) {
      return null;
    }
    const role = entry.role?.trim();
    return {
      ...entry,
      name,
      side,
      role: role || undefined,
      maxHealth: entry.maxHealth ?? undefined,
      maxFocus: entry.maxFocus ?? undefined,
      imagePath: entry.imagePath || undefined,
    };
  }
}
