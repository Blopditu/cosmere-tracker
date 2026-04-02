import { CommonModule } from '@angular/common';
import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CharacterStatSheet, ParticipantTemplate, PartyMember, computeCharacterStatSheet, createEmptyCharacterStatSheet } from '@shared/domain';
import { SessionStoreService } from '../../core/session-store.service';
import { CombatPresetActionEditorComponent } from '../../shared/combat-preset-action-editor.component';
import { CharacterStatSheetEditorComponent } from '../../shared/character-stat-sheet-editor.component';
import { RosharIconComponent } from '../../shared/roshar-icon.component';

@Component({
  selector: 'app-campaign-roster-page',
  imports: [CommonModule, FormsModule, RosharIconComponent, CombatPresetActionEditorComponent, CharacterStatSheetEditorComponent],
  template: `
    <section class="page-header campaign-roster-header card engraved-panel">
      <div class="route-heading">
        <p class="eyebrow">Campaign roster</p>
        <h2>Players and enemy templates</h2>
        <p>Manage persistent player characters and reusable enemy templates outside any single session.</p>
      </div>
      <div class="dashboard-command-links">
        <div class="session-command-chips">
          <span class="tag-chip">
            <app-roshar-icon key="sessions" label="Campaign players" tone="sapphire" [size]="14" />
            {{ partyDraft().length }} players
          </span>
          <span class="tag-chip">
            <app-roshar-icon key="combat" label="Enemy templates" tone="ruby" [size]="14" />
            {{ enemyDraft().length }} enemy templates
          </span>
        </div>
        <button type="button" class="shell-shortcut" (click)="saveRoster()">
          <app-roshar-icon key="aid" label="Save campaign roster" tone="gold" [size]="16" />
          <span>Save roster</span>
        </button>
      </div>
    </section>

    <section class="card engraved-panel campaign-roster-card" data-tour="campaign-roster">
      <div class="roster-view-toggle">
        <button type="button" class="button-outline micro-button" [class.active]="rosterView() === 'party'" (click)="rosterView.set('party')">Players</button>
        <button type="button" class="button-outline micro-button" [class.active]="rosterView() === 'enemy'" (click)="rosterView.set('enemy')">Enemies</button>
      </div>

      @if (rosterView() === 'party') {
        <section class="inset-panel" data-tour="campaign-players">
          <div class="card-header">
            <div class="section-heading">
              <app-roshar-icon key="sessions" label="Campaign players" tone="sapphire" [size]="18" />
              <h3>Players</h3>
            </div>
            <button type="button" class="button-outline shell-shortcut" (click)="addPartyMember()">
              <app-roshar-icon key="aid" label="Add player" tone="sapphire" [size]="16" />
              <span>Add player</span>
            </button>
          </div>
          <p class="muted roster-helper-copy">These are persistent characters reused across sessions. Add them once here, then include them in specific sessions from the session dashboard.</p>
          <div class="roster-editor-list">
            @for (member of partyDraft(); track member.id) {
              <article class="roster-editor-row">
                <input [(ngModel)]="member.name" [ngModelOptions]="{ standalone: true }" type="text" placeholder="Name" />
                <input [(ngModel)]="member.role" [ngModelOptions]="{ standalone: true }" type="text" placeholder="Role" />
                <span class="tag-chip">HP {{ resourceSummary(member).health }}</span>
                <span class="tag-chip">Focus {{ resourceSummary(member).focus }}</span>
                <span class="tag-chip">Investiture {{ resourceSummary(member).investiture }}</span>
                <button type="button" class="button-outline button-danger micro-button" (click)="confirmRosterRemoval('party', member.id, member.name)">Remove</button>
                <app-character-stat-sheet-editor
                  class="roster-stat-editor"
                  [stats]="member.stats"
                  mode="party"
                  (statsChange)="updatePartyStats(member.id, $event)" />
              </article>
            } @empty {
              <article class="empty-card">No campaign players yet. Add the recurring party here once, then assign them into sessions as needed.</article>
            }
          </div>
        </section>
      } @else {
        <section class="inset-panel" data-tour="campaign-enemies">
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
          <p class="muted roster-helper-copy">Enemy templates stay reusable across combats and sessions. Combat setup creates copies from these templates when you add enemies to an encounter.</p>
          <div class="roster-editor-list">
            @for (enemy of enemyDraft(); track enemy.id) {
              <article class="roster-editor-row enemy-template-row">
                <input [(ngModel)]="enemy.name" [ngModelOptions]="{ standalone: true }" type="text" placeholder="Enemy name" />
                <input [(ngModel)]="enemy.role" [ngModelOptions]="{ standalone: true }" type="text" placeholder="Role" />
                <span class="tag-chip">HP {{ resourceSummary(enemy).health }}</span>
                <span class="tag-chip">Focus {{ resourceSummary(enemy).focus }}</span>
                <span class="tag-chip">Investiture {{ resourceSummary(enemy).investiture }}</span>
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
                <app-combat-preset-action-editor
                  class="roster-preset-editor"
                  [actions]="enemy.presetActions"
                  title="Enemy preset actions"
                  emptyLabel="No preset actions yet. Add reusable enemy actions here."
                  (actionsChange)="updateEnemyPresetActions(enemy.id, $event)" />
                <app-character-stat-sheet-editor
                  class="roster-stat-editor"
                  [stats]="enemy.stats"
                  mode="enemy"
                  (statsChange)="updateEnemyStats(enemy.id, $event)" />
              </article>
            } @empty {
              <article class="empty-card">No enemy templates yet. Add reusable foes here so combat setup can clone them into new encounters.</article>
            }
          </div>
          @if (uploadError()) {
            <p class="import-message">{{ uploadError() }}</p>
          }
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
        <p class="muted">Existing combats keep their own copied participants, but future sessions and encounters will no longer be able to use this entry once you save.</p>
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
  readonly rosterView = signal<'party' | 'enemy'>('party');
  readonly uploadingEnemyId = signal('');
  readonly uploadError = signal('');
  readonly pendingRemoval = signal<{ type: 'party' | 'enemy'; id: string; label: string } | null>(null);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    const roster = await this.sessionStore.getCampaignRoster();
    this.partyDraft.set(roster.partyMembers.map((member) => ({ ...member })));
    this.enemyDraft.set(roster.participantTemplates.map((template) => ({ ...template, presetActions: [...template.presetActions] })));
  }

  addPartyMember(): void {
    this.partyDraft.update((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        name: '',
        side: 'pc',
        role: '',
        stats: createEmptyCharacterStatSheet(),
        maxHealth: undefined,
        maxFocus: undefined,
        maxInvestiture: undefined,
      },
    ]);
  }

  addEnemyTemplate(): void {
    this.enemyDraft.update((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        name: '',
        side: 'enemy',
        role: '',
        stats: createEmptyCharacterStatSheet(),
        maxHealth: undefined,
        maxFocus: undefined,
        maxInvestiture: undefined,
        presetActions: [],
      },
    ]);
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
      this.partyDraft.update((items) => items.filter((member) => member.id !== pending.id));
    } else {
      this.enemyDraft.update((items) => items.filter((enemy) => enemy.id !== pending.id));
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

  resourceSummary(entry: PartyMember | ParticipantTemplate): { health: number; focus: number; investiture: number } {
    const computed = computeCharacterStatSheet(entry.stats);
    return computed.resources;
  }
}
