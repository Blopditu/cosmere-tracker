import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NPC, NpcUpsertInput, resolveLayered } from '@shared/domain';

const EMPTY_TEXT = '';

@Component({
  selector: 'app-campaign-npc-drawer',
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="war-room-drawer-shell">
      <div class="war-room-drawer-head">
        <div>
          <p class="eyebrow">NPCs</p>
          <h3>Manage campaign NPCs</h3>
          <p>Keep reusable NPC truth, portrayal defaults, and status tags in one place.</p>
        </div>

        <div class="button-row wrap-row">
          <button type="button" class="button-outline micro-action" (click)="startCreate()">New NPC</button>
          <button type="button" class="button-outline micro-action" (click)="close.emit()">Close</button>
        </div>
      </div>

      <div class="war-room-entity-workspace">
        <aside class="war-room-entity-list">
          @for (npc of npcs(); track npc.id) {
            <button
              type="button"
              class="war-room-entity-row"
              [class.war-room-entity-row-active]="selectedNpcId() === npc.id"
              (click)="selectNpc(npc.id)"
            >
              <strong>{{ npc.canonicalName }}</strong>
              <span>{{ npc.key }}</span>
            </button>
          } @empty {
            <p class="empty-inline">No NPCs yet.</p>
          }
        </aside>

        <form class="war-room-form" [formGroup]="form" (ngSubmit)="submit()">
          <div class="war-room-form-grid two-up">
            <label class="compact-field">
              <span>Name</span>
              <input formControlName="canonicalName" type="text" />
            </label>

            <label class="compact-field">
              <span>Key</span>
              <input formControlName="key" type="text" />
            </label>
          </div>

          <label class="compact-field">
            <span>Aliases</span>
            <textarea formControlName="aliasesText" rows="2"></textarea>
          </label>

          <label class="compact-field">
            <span>Canonical summary</span>
            <textarea formControlName="canonicalSummary" rows="4"></textarea>
          </label>

          <label class="compact-field">
            <span>Private truth</span>
            <textarea formControlName="privateTruth" rows="4"></textarea>
          </label>

          <label class="compact-field">
            <span>Portrayal defaults</span>
            <textarea formControlName="portrayalDefaults" rows="4"></textarea>
          </label>

          <label class="compact-field">
            <span>Status tags</span>
            <textarea formControlName="statusTagsText" rows="2"></textarea>
          </label>

          <div class="button-row war-room-form-actions">
            @if (selectedNpcId()) {
              <button type="button" class="button-outline button-danger micro-action" (click)="requestDelete.emit(selectedNpcId()!)">
                Delete NPC
              </button>
            }
            <button type="submit">{{ selectedNpcId() ? 'Save NPC' : 'Create NPC' }}</button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class CampaignNpcDrawerComponent {
  readonly npcs = input<NPC[]>([]);
  readonly close = output<void>();
  readonly saveNpc = output<NpcUpsertInput>();
  readonly requestDelete = output<string>();

  readonly isCreating = signal(false);
  readonly selectedNpcId = signal<string | null>(null);
  readonly selectedNpc = computed(() => this.npcs().find((npc) => npc.id === this.selectedNpcId()) ?? null);

  readonly form = new FormGroup({
    canonicalName: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    key: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    aliasesText: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    canonicalSummary: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    privateTruth: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    portrayalDefaults: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    statusTagsText: new FormControl(EMPTY_TEXT, { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const npcs = this.npcs();
      if (this.isCreating()) {
        this.resetForm(null);
        return;
      }
      const selected = this.selectedNpcId();
      if (!npcs.length) {
        this.selectedNpcId.set(null);
        this.resetForm(null);
        return;
      }
      if (!selected || !npcs.some((npc) => npc.id === selected)) {
        this.selectedNpcId.set(npcs[0]!.id);
        return;
      }
      this.resetForm(this.selectedNpc());
    });
  }

  selectNpc(npcId: string): void {
    this.isCreating.set(false);
    this.selectedNpcId.set(npcId);
  }

  startCreate(): void {
    this.isCreating.set(true);
    this.selectedNpcId.set(null);
    this.resetForm(null);
  }

  submit(): void {
    this.saveNpc.emit({
      npcId: this.selectedNpcId() ?? undefined,
      canonicalName: this.form.controls.canonicalName.value,
      key: this.form.controls.key.value,
      aliases: this.parseLines(this.form.controls.aliasesText.value),
      canonicalSummary: this.form.controls.canonicalSummary.value,
      privateTruth: this.form.controls.privateTruth.value,
      portrayalDefaults: this.form.controls.portrayalDefaults.value,
      statusTags: this.parseLines(this.form.controls.statusTagsText.value),
    });
  }

  private resetForm(npc: NPC | null): void {
    const resolved = npc ? resolveLayered(npc.content) : null;
    this.form.reset({
      canonicalName: npc?.canonicalName ?? EMPTY_TEXT,
      key: npc?.key ?? EMPTY_TEXT,
      aliasesText: npc?.aliases.join(', ') ?? EMPTY_TEXT,
      canonicalSummary: resolved?.canonicalSummary[0]?.text ?? EMPTY_TEXT,
      privateTruth: resolved?.privateTruth[0]?.text ?? EMPTY_TEXT,
      portrayalDefaults: resolved?.portrayalDefaults[0]?.text ?? EMPTY_TEXT,
      statusTagsText: npc?.campaignState.statusTags.join(', ') ?? EMPTY_TEXT,
    });
  }

  private parseLines(value: string): string[] {
    return value
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
}
