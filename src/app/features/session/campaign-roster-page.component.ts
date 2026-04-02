import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CharacterStatSheet, ParticipantTemplate, PartyMember, computeCharacterStatSheet, createEmptyCharacterStatSheet } from '@shared/domain';
import { SessionStoreService } from '../../core/session-store.service';
import { CombatPresetActionEditorComponent } from '../../shared/combat-preset-action-editor.component';
import { CharacterStatSheetEditorComponent } from '../../shared/character-stat-sheet-editor.component';
import { RosharIconComponent } from '../../shared/roshar-icon.component';

const PARTY_VIEW = 'party';
const ENEMY_VIEW = 'enemy';
type RosterView = typeof PARTY_VIEW | typeof ENEMY_VIEW;

@Component({
  selector: 'app-campaign-roster-page',
  imports: [CommonModule, RosharIconComponent, CombatPresetActionEditorComponent, CharacterStatSheetEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card engraved-panel campaign-roster-card" data-tour="campaign-roster">
      <div class="card-header roster-management-toolbar">
        <div class="section-heading">
          <app-roshar-icon key="sessions" label="Campaign roster" tone="gold" [size]="18" />
          <h3>Players and enemy templates</h3>
        </div>
        <div class="button-row">
          <span class="tag-chip">
            <app-roshar-icon key="sessions" label="Campaign players" tone="sapphire" [size]="14" />
            {{ partyDraft().length }} players
          </span>
          <span class="tag-chip">
            <app-roshar-icon key="combat" label="Enemy templates" tone="ruby" [size]="14" />
            {{ enemyDraft().length }} enemy templates
          </span>
          <button type="button" class="shell-shortcut" (click)="saveRoster()">
            <app-roshar-icon key="aid" label="Save campaign roster" tone="gold" [size]="16" />
            <span>Save roster</span>
          </button>
        </div>
      </div>
      @if (rosterView() === 'party') {
        <section class="roster-workspace" data-tour="campaign-players">
          <aside class="inset-panel roster-selector-panel">
            <div class="card-header roster-panel-toolbar">
              <div class="roster-view-toggle roster-view-toggle--inline">
                <button type="button" class="button-outline micro-button" [class.active]="rosterView() === 'party'" (click)="rosterView.set('party')">Players</button>
                <button type="button" class="button-outline micro-button" [class.active]="rosterView() === 'enemy'" (click)="rosterView.set('enemy')">Enemies</button>
              </div>
              <button type="button" class="button-outline shell-shortcut" (click)="addPartyMember()">
                <app-roshar-icon key="aid" label="Add player" tone="sapphire" [size]="16" />
                <span>Add player</span>
              </button>
            </div>
            <div class="roster-selector-list">
              @for (member of partyDraft(); track member.id) {
                <article class="roster-selector-item" [class.selected]="selectedPartyMemberId() === member.id">
                  <button type="button" class="roster-selector-button" (click)="selectPartyMember(member.id)">
                    <div class="roster-selector-copy">
                      <strong>{{ member.name || 'New player' }}</strong>
                      <small>{{ member.role || 'No role set' }}</small>
                    </div>
                    <div class="roster-selector-resources">
                      <span class="tag-chip">HP {{ resourceSummary(member).health }}</span>
                      <span class="tag-chip">Focus {{ resourceSummary(member).focus }}</span>
                      <span class="tag-chip">Investiture {{ resourceSummary(member).investiture }}</span>
                    </div>
                  </button>
                  <div class="roster-selector-actions">
                    <button type="button" class="button-outline button-danger micro-button" (click)="confirmRosterRemoval('party', member.id, member.name)">
                      Remove
                    </button>
                  </div>
                </article>
              } @empty {
                <article class="empty-card">No campaign players yet. Add the recurring party here once, then assign them into sessions as needed.</article>
              }
            </div>
          </aside>

          <section class="inset-panel roster-detail-panel">
            @if (selectedPartyMember(); as member) {
              <header class="roster-detail-header">
                <div class="roster-detail-fields">
                  <label class="compact-field">
                    <span>Name</span>
                    <input type="text" [value]="member.name" placeholder="Name" (input)="updatePartyText(member.id, 'name', textValue($event))" />
                  </label>
                  <label class="compact-field">
                    <span>Role</span>
                    <input type="text" [value]="member.role || ''" placeholder="Role" (input)="updatePartyText(member.id, 'role', textValue($event))" />
                  </label>
                </div>
                <div class="roster-detail-side">
                  <button type="button" class="button-outline button-danger micro-button" (click)="confirmRosterRemoval('party', member.id, member.name)">
                    Remove player
                  </button>
                </div>
              </header>

              <app-character-stat-sheet-editor [stats]="member.stats" mode="party" (statsChange)="updatePartyStats(member.id, $event)" />
            } @else {
              <article class="empty-card roster-detail-empty">No player selected. Add or choose a campaign player to start editing the sheet.</article>
            }
          </section>
        </section>
      } @else {
        <section class="roster-workspace" data-tour="campaign-enemies">
          <aside class="inset-panel roster-selector-panel">
            <div class="card-header roster-panel-toolbar">
              <div class="roster-view-toggle roster-view-toggle--inline">
                <button type="button" class="button-outline micro-button" [class.active]="rosterView() === 'party'" (click)="rosterView.set('party')">Players</button>
                <button type="button" class="button-outline micro-button" [class.active]="rosterView() === 'enemy'" (click)="rosterView.set('enemy')">Enemies</button>
              </div>
              <button type="button" class="button-outline shell-shortcut" (click)="addEnemyTemplate()">
                <app-roshar-icon key="aid" label="Add enemy template" tone="ruby" [size]="16" />
                <span>Add enemy</span>
              </button>
            </div>
            <div class="roster-selector-list">
              @for (enemy of enemyDraft(); track enemy.id) {
                <article class="roster-selector-item" [class.selected]="selectedEnemyId() === enemy.id">
                  <button type="button" class="roster-selector-button" (click)="selectEnemy(enemy.id)">
                    <div class="roster-selector-copy">
                      <strong>{{ enemy.name || 'New enemy template' }}</strong>
                      <small>{{ enemy.role || 'No role set' }}</small>
                    </div>
                    <div class="roster-selector-resources">
                      <span class="tag-chip">HP {{ resourceSummary(enemy).health }}</span>
                      <span class="tag-chip">Focus {{ resourceSummary(enemy).focus }}</span>
                      <span class="tag-chip">Investiture {{ resourceSummary(enemy).investiture }}</span>
                    </div>
                  </button>
                  <div class="roster-selector-actions">
                    <button type="button" class="button-outline button-danger micro-button" (click)="confirmRosterRemoval('enemy', enemy.id, enemy.name)">
                      Remove
                    </button>
                  </div>
                </article>
              } @empty {
                <article class="empty-card">No enemy templates yet. Add reusable foes here so combat setup can clone them into new encounters.</article>
              }
            </div>
          </aside>

          <section class="inset-panel roster-detail-panel">
            @if (selectedEnemy(); as enemy) {
              <header class="roster-detail-header roster-detail-header--enemy">
                <div class="roster-detail-fields">
                  <label class="compact-field">
                    <span>Name</span>
                    <input type="text" [value]="enemy.name" placeholder="Enemy name" (input)="updateEnemyText(enemy.id, 'name', textValue($event))" />
                  </label>
                  <label class="compact-field">
                    <span>Role</span>
                    <input type="text" [value]="enemy.role || ''" placeholder="Role" (input)="updateEnemyText(enemy.id, 'role', textValue($event))" />
                  </label>
                </div>
                <div class="roster-detail-side">
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
                    <button type="button" class="button-outline button-danger micro-button" (click)="confirmRosterRemoval('enemy', enemy.id, enemy.name)">
                      Remove enemy
                    </button>
                  </div>
                </div>
              </header>

              <div class="roster-detail-stack">
                <app-character-stat-sheet-editor [stats]="enemy.stats" mode="enemy" (statsChange)="updateEnemyStats(enemy.id, $event)" />
                <app-combat-preset-action-editor
                  [actions]="enemy.presetActions"
                  title="Enemy preset actions"
                  emptyLabel="No preset actions yet. Add reusable enemy actions here."
                  [compact]="true"
                  (actionsChange)="updateEnemyPresetActions(enemy.id, $event)" />
              </div>
            } @else {
              <article class="empty-card roster-detail-empty">No enemy template selected. Add or choose an enemy to edit its lean stat block.</article>
            }
            @if (uploadError()) {
              <p class="import-message">{{ uploadError() }}</p>
            }
          </section>
        </section>
      }
    </section>

    @if (pendingRemoval()) {
      <div class="confirm-modal-backdrop" (click)="cancelRosterRemoval()"></div>
      <section class="confirm-modal card engraved-panel" role="dialog" aria-modal="true" aria-labelledby="campaign-roster-delete-title">
        <div class="card-header">
          <div class="section-heading">
            <app-roshar-icon key="damage" label="Delete roster entry" tone="ruby" [size]="18" />
            <h3 id="campaign-roster-delete-title">Delete roster entry?</h3>
          </div>
        </div>
        <p>
          Remove
          <strong>{{ pendingRemoval()!.label || (pendingRemoval()!.type === 'party' ? 'this player' : 'this enemy template') }}</strong>
          from the campaign roster?
        </p>
        <p class="muted">Existing combats keep their own copied participants, but this removal now saves immediately and future sessions or encounters will no longer be able to use this entry.</p>
        <div class="button-row">
          <button type="button" class="button-outline" (click)="cancelRosterRemoval()">Cancel</button>
          <button type="button" class="button-danger" (click)="confirmPendingRemoval()">Delete</button>
        </div>
      </section>
    }
  `,
})
export class CampaignRosterPageComponent {
  private readonly sessionStore = inject(SessionStoreService);
  readonly partyDraft = signal<PartyMember[]>([]);
  readonly enemyDraft = signal<ParticipantTemplate[]>([]);
  readonly rosterView = signal<RosterView>('party');
  readonly uploadingEnemyId = signal('');
  readonly uploadError = signal('');
  readonly pendingRemoval = signal<{ type: RosterView; id: string; label: string } | null>(null);
  readonly selectedPartyMemberId = signal('');
  readonly selectedEnemyId = signal('');
  readonly selectedPartyMember = computed(() => this.partyDraft().find((member) => member.id === this.selectedPartyMemberId()));
  readonly selectedEnemy = computed(() => this.enemyDraft().find((enemy) => enemy.id === this.selectedEnemyId()));

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    const roster = await this.sessionStore.getCampaignRoster();
    const partyMembers = roster.partyMembers.map((member) => ({ ...member }));
    const enemyTemplates = roster.participantTemplates.map((template) => ({ ...template, presetActions: [...template.presetActions] }));
    this.partyDraft.set(partyMembers);
    this.enemyDraft.set(enemyTemplates);
    this.syncPartySelection();
    this.syncEnemySelection();
  }

  addPartyMember(): void {
    const member: PartyMember = {
      id: crypto.randomUUID(),
      name: '',
      side: 'pc',
      role: '',
      stats: createEmptyCharacterStatSheet(),
      maxHealth: undefined,
      maxFocus: undefined,
      maxInvestiture: undefined,
    };
    this.partyDraft.update((items) => [...items, member]);
    this.selectedPartyMemberId.set(member.id);
  }

  addEnemyTemplate(): void {
    const enemy: ParticipantTemplate = {
      id: crypto.randomUUID(),
      name: '',
      side: 'enemy',
      role: '',
      stats: createEmptyCharacterStatSheet(),
      maxHealth: undefined,
      maxFocus: undefined,
      maxInvestiture: undefined,
      presetActions: [],
    };
    this.enemyDraft.update((items) => [...items, enemy]);
    this.selectedEnemyId.set(enemy.id);
  }

  selectPartyMember(memberId: string): void {
    this.selectedPartyMemberId.set(memberId);
  }

  selectEnemy(enemyId: string): void {
    this.selectedEnemyId.set(enemyId);
  }

  updatePartyText(memberId: string, field: 'name' | 'role', value: string): void {
    this.partyDraft.update((items) => items.map((member) => (member.id === memberId ? { ...member, [field]: value } : member)));
  }

  updateEnemyText(enemyId: string, field: 'name' | 'role', value: string): void {
    this.enemyDraft.update((items) => items.map((enemy) => (enemy.id === enemyId ? { ...enemy, [field]: value } : enemy)));
  }

  updateEnemyPresetActions(enemyId: string, presetActions: ParticipantTemplate['presetActions']): void {
    this.enemyDraft.update((items) =>
      items.map((enemy) => (enemy.id === enemyId ? { ...enemy, presetActions: [...presetActions] } : enemy)),
    );
  }

  updatePartyStats(memberId: string, stats: CharacterStatSheet): void {
    this.partyDraft.update((items) => items.map((member) => (member.id === memberId ? { ...member, stats } : member)));
  }

  updateEnemyStats(enemyId: string, stats: CharacterStatSheet): void {
    this.enemyDraft.update((items) => items.map((enemy) => (enemy.id === enemyId ? { ...enemy, stats } : enemy)));
  }

  confirmRosterRemoval(type: RosterView, id: string, label: string | undefined): void {
    this.pendingRemoval.set({ type, id, label: label?.trim() || '' });
  }

  cancelRosterRemoval(): void {
    this.pendingRemoval.set(null);
  }

  async confirmPendingRemoval(): Promise<void> {
    const pending = this.pendingRemoval();
    if (!pending) {
      return;
    }
    if (pending.type === PARTY_VIEW) {
      this.partyDraft.update((items) => items.filter((member) => member.id !== pending.id));
      this.syncPartySelection();
    } else {
      this.enemyDraft.update((items) => items.filter((enemy) => enemy.id !== pending.id));
      this.syncEnemySelection();
    }
    this.pendingRemoval.set(null);
    await this.saveRoster();
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
      const imagePath = await this.sessionStore.uploadEnemySheet('campaign-roster', file);
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
    const partyMembers = this.partyDraft()
      .map((member) => this.normalizePartyMember(member))
      .filter((member): member is PartyMember => Boolean(member));
    const participantTemplates = this.enemyDraft()
      .map((template) => this.normalizeEnemyTemplate(template))
      .filter((template): template is ParticipantTemplate => Boolean(template));

    await this.sessionStore.updateCampaignRoster({ partyMembers, participantTemplates });
    await this.load();
  }

  resourceSummary(entry: PartyMember | ParticipantTemplate): { health: number; focus: number; investiture: number } {
    return computeCharacterStatSheet(entry.stats).resources;
  }

  textValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  private syncPartySelection(): void {
    if (this.partyDraft().some((member) => member.id === this.selectedPartyMemberId())) {
      return;
    }
    this.selectedPartyMemberId.set(this.partyDraft()[0]?.id ?? '');
  }

  private syncEnemySelection(): void {
    if (this.enemyDraft().some((enemy) => enemy.id === this.selectedEnemyId())) {
      return;
    }
    this.selectedEnemyId.set(this.enemyDraft()[0]?.id ?? '');
  }

  private normalizePartyMember(member: PartyMember): PartyMember | null {
    const name = member.name.trim();
    if (!name) {
      return null;
    }
    const role = member.role?.trim();
    return {
      ...member,
      name,
      side: member.side === 'ally' ? 'ally' : 'pc',
      role: role || undefined,
      stats: member.stats,
      maxHealth: member.maxHealth ?? undefined,
      maxFocus: member.maxFocus ?? undefined,
      maxInvestiture: member.maxInvestiture ?? undefined,
      imagePath: member.imagePath || undefined,
    };
  }

  private normalizeEnemyTemplate(template: ParticipantTemplate): ParticipantTemplate | null {
    const name = template.name.trim();
    if (!name) {
      return null;
    }
    const role = template.role?.trim();
    return {
      ...template,
      name,
      side: template.side === 'npc' ? 'npc' : 'enemy',
      role: role || undefined,
      stats: template.stats,
      maxHealth: template.maxHealth ?? undefined,
      maxFocus: template.maxFocus ?? undefined,
      maxInvestiture: template.maxInvestiture ?? undefined,
      imagePath: template.imagePath || undefined,
      presetActions: template.presetActions,
    };
  }
}
