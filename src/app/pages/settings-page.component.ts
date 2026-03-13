import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AppStoreService } from '../core/app-store.service';

@Component({
  selector: 'app-settings-page',
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Settings</p>
        <h1>Local JSON storage and tracker defaults</h1>
        <p>Manage support tags, import or export data, and reset the demo dataset.</p>
      </div>
    </section>

    <section class="card">
      <div class="card-header">
        <h2>Tracker defaults</h2>
        <span class="pill">Browser local storage</span>
      </div>
      <form class="form-grid" [formGroup]="settingsForm" (ngSubmit)="saveSettings()">
        <label class="checkbox-row">
          <input formControlName="preferredRoundTracking" type="checkbox" />
          <span>Enable round tracking by default for new fights</span>
        </label>
        <label class="full-width">
          <span>Custom support tags</span>
          <input formControlName="customTags" type="text" placeholder="comma, separated, tags" />
        </label>
        <div class="tag-cloud">
          @for (tag of store.supportTags(); track tag) {
            <span class="tag-chip">{{ tag }}</span>
          }
        </div>
        <div class="button-row">
          <button type="submit">Save settings</button>
        </div>
      </form>
    </section>

    <section class="card">
      <div class="card-header">
        <h2>Import / export</h2>
        <span class="pill">Schema v1</span>
      </div>
      <div class="button-row">
        <button type="button" (click)="export()">Export JSON</button>
      </div>
      <form class="form-grid" [formGroup]="importForm" (ngSubmit)="importData()">
        <label>
          <span>Import mode</span>
          <select formControlName="mode">
            <option value="replace">Replace current data</option>
            <option value="merge">Merge by id</option>
          </select>
        </label>
        <label class="full-width">
          <span>JSON file</span>
          <input type="file" accept="application/json" (change)="onFileSelected($event)" />
        </label>
        <div class="button-row">
          <button type="submit">Import JSON</button>
        </div>
      </form>
      @if (status()) {
        <p class="status-message">{{ status() }}</p>
      }
    </section>

    <section class="card">
      <div class="card-header">
        <h2>Danger zone</h2>
        <span class="pill">Demo reset</span>
      </div>
      <div class="button-row">
        <button class="button-danger" type="button" (click)="reset()">Reset to demo data</button>
      </div>
    </section>
  `,
})
export class SettingsPageComponent {
  readonly store = inject(AppStoreService);
  private readonly fb = inject(FormBuilder);

  readonly status = signal('');
  private selectedJson = '';

  readonly settingsForm = this.fb.nonNullable.group({
    preferredRoundTracking: [this.store.data().settings.preferredRoundTracking],
    customTags: [this.store.data().settings.customSupportTags.join(', ')],
  });

  readonly importForm = this.fb.nonNullable.group({
    mode: ['replace' as 'replace' | 'merge'],
  });

  saveSettings(): void {
    const value = this.settingsForm.getRawValue();
    this.store.setPreferredRoundTracking(value.preferredRoundTracking);
    this.store.setCustomSupportTags(value.customTags.split(',').map((tag) => tag.trim()));
    this.status.set('Settings saved.');
  }

  export(): void {
    const json = this.store.exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cosmere-combat-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    this.status.set('Export created.');
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.selectedJson = file ? await file.text() : '';
  }

  importData(): void {
    if (!this.selectedJson) {
      this.status.set('Choose a JSON file first.');
      return;
    }
    try {
      this.store.importData(this.selectedJson, this.importForm.getRawValue().mode);
      this.status.set('Import completed.');
    } catch (error) {
      this.status.set(error instanceof Error ? error.message : 'Import failed.');
    }
  }

  reset(): void {
    if (!window.confirm('Reset all saved data to the seeded demo state?')) {
      return;
    }
    this.store.resetToDemoData();
    this.status.set('Demo data restored.');
  }
}
