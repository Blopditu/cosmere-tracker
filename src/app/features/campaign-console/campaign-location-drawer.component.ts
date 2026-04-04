import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Location, LocationUpsertInput, resolveLayered } from '@shared/domain';

const EMPTY_TEXT = '';

@Component({
  selector: 'app-campaign-location-drawer',
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="war-room-drawer-shell">
      <div class="war-room-drawer-head">
        <div>
          <p class="eyebrow">Locations</p>
          <h3>Manage locations</h3>
          <p>Keep short public purpose and GM truth attached to reusable campaign places.</p>
        </div>

        <div class="button-row wrap-row">
          <button type="button" class="button-outline micro-action" (click)="startCreate()">New location</button>
          <button type="button" class="button-outline micro-action" (click)="close.emit()">Close</button>
        </div>
      </div>

      <div class="war-room-entity-workspace">
        <aside class="war-room-entity-list">
          @for (location of locations(); track location.id) {
            <button
              type="button"
              class="war-room-entity-row"
              [class.war-room-entity-row-active]="selectedLocationId() === location.id"
              (click)="selectLocation(location.id)"
            >
              <strong>{{ location.name }}</strong>
              <span>{{ location.kind }}</span>
            </button>
          } @empty {
            <p class="empty-inline">No locations yet.</p>
          }
        </aside>

        <form class="war-room-form" [formGroup]="form" (ngSubmit)="submit()">
          <div class="war-room-form-grid two-up">
            <label class="compact-field">
              <span>Name</span>
              <input formControlName="name" type="text" />
            </label>

            <label class="compact-field">
              <span>Key</span>
              <input formControlName="key" type="text" />
            </label>

            <label class="compact-field">
              <span>Kind</span>
              <select formControlName="kind">
                <option value="region">Region</option>
                <option value="settlement">Settlement</option>
                <option value="site">Site</option>
                <option value="room">Room</option>
              </select>
            </label>
          </div>

          <label class="compact-field">
            <span>Tags</span>
            <textarea formControlName="tagsText" rows="2"></textarea>
          </label>

          <label class="compact-field">
            <span>Public summary</span>
            <textarea formControlName="publicSummary" rows="4"></textarea>
          </label>

          <label class="compact-field">
            <span>GM truth</span>
            <textarea formControlName="gmTruth" rows="4"></textarea>
          </label>

          <div class="button-row war-room-form-actions">
            @if (selectedLocationId()) {
              <button type="button" class="button-outline button-danger micro-action" (click)="requestDelete.emit(selectedLocationId()!)">
                Delete location
              </button>
            }
            <button type="submit">{{ selectedLocationId() ? 'Save location' : 'Create location' }}</button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class CampaignLocationDrawerComponent {
  readonly locations = input<Location[]>([]);
  readonly close = output<void>();
  readonly saveLocation = output<LocationUpsertInput>();
  readonly requestDelete = output<string>();

  readonly isCreating = signal(false);
  readonly selectedLocationId = signal<string | null>(null);
  readonly selectedLocation = computed(() => this.locations().find((location) => location.id === this.selectedLocationId()) ?? null);

  readonly form = new FormGroup({
    name: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    key: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    kind: new FormControl<Location['kind']>('site', { nonNullable: true }),
    tagsText: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    publicSummary: new FormControl(EMPTY_TEXT, { nonNullable: true }),
    gmTruth: new FormControl(EMPTY_TEXT, { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const locations = this.locations();
      if (this.isCreating()) {
        this.resetForm(null);
        return;
      }
      const selected = this.selectedLocationId();
      if (!locations.length) {
        this.selectedLocationId.set(null);
        this.resetForm(null);
        return;
      }
      if (!selected || !locations.some((location) => location.id === selected)) {
        this.selectedLocationId.set(locations[0]!.id);
        return;
      }
      this.resetForm(this.selectedLocation());
    });
  }

  selectLocation(locationId: string): void {
    this.isCreating.set(false);
    this.selectedLocationId.set(locationId);
  }

  startCreate(): void {
    this.isCreating.set(true);
    this.selectedLocationId.set(null);
    this.resetForm(null);
  }

  submit(): void {
    this.saveLocation.emit({
      locationId: this.selectedLocationId() ?? undefined,
      name: this.form.controls.name.value,
      key: this.form.controls.key.value,
      kind: this.form.controls.kind.value,
      publicSummary: this.form.controls.publicSummary.value,
      gmTruth: this.form.controls.gmTruth.value,
      tags: this.parseLines(this.form.controls.tagsText.value),
    });
  }

  private resetForm(location: Location | null): void {
    const resolved = location ? resolveLayered(location.content) : null;
    this.form.reset({
      name: location?.name ?? EMPTY_TEXT,
      key: location?.key ?? EMPTY_TEXT,
      kind: location?.kind ?? 'site',
      tagsText: location?.tags.join(', ') ?? EMPTY_TEXT,
      publicSummary: resolved?.publicSummary[0]?.text ?? EMPTY_TEXT,
      gmTruth: resolved?.gmTruth[0]?.text ?? EMPTY_TEXT,
    });
  }

  private parseLines(value: string): string[] {
    return value
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
}
