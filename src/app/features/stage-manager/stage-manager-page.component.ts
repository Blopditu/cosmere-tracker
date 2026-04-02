import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { SessionSummary, StageScene } from '@shared/domain';
import { SessionStoreService } from '../../core/session-store.service';
import { RosharIconComponent } from '../../shared/roshar-icon.component';
import { StageManagerStore } from './stage-manager.store';

@Component({
  selector: 'app-stage-manager-page',
  imports: [CommonModule, ReactiveFormsModule, RosharIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-header stage-manager-header card engraved-panel">
      <div class="route-heading">
        <p class="eyebrow">Stage manager</p>
        <h2>Cue deck and live display</h2>
        <p>Editing scenes never changes the player display. Only publish updates the live screen, so draft and live always stay separate.</p>
      </div>
      <div class="stage-header-actions">
        <div class="stage-live-status">
          <span class="tag-chip live-chip">
            <app-roshar-icon key="live" label="Current live scene" tone="emerald" [size]="14" />
            Live: {{ liveTitle() }}
          </span>
        </div>
        <div class="button-row">
          <button type="button" class="shell-shortcut" (click)="openDisplay()">
            <app-roshar-icon key="live" label="Open player display" tone="gold" [size]="16" />
            <span>Open player display</span>
          </button>
          <button type="button" class="button-outline shell-shortcut" (click)="openFullscreenDisplay()">
            <app-roshar-icon key="live" label="Open fullscreen display" tone="topaz" [size]="16" />
            <span>Open fullscreen display</span>
          </button>
          <button
            type="button"
            class="button-outline shell-shortcut live-trigger"
            data-tour="stage-publish"
            [disabled]="!selectedScene() || store.uploadState() === 'uploading'"
            (click)="publish()"
          >
            <app-roshar-icon key="live" label="Go live" tone="emerald" [size]="16" />
            <span>Go live</span>
          </button>
        </div>
      </div>
    </section>

    <div class="stage-grid stage-console">
      <section class="card engraved-panel" data-tour="stage-scenes">
        <div class="card-header">
          <div class="section-heading">
            <app-roshar-icon key="stage" label="Scenes" tone="sapphire" [size]="18" />
            <h3>Scenes</h3>
          </div>
          <div class="button-row stage-scene-actions">
            <button type="button" class="button-outline shell-shortcut" (click)="toggleImportPanel()">
              <app-roshar-icon key="sessions" label="Import from session" tone="sapphire" [size]="14" />
              <span>{{ importPanelOpen() ? 'Close import' : 'Import from session' }}</span>
            </button>
            <button type="button" class="button-outline shell-shortcut" (click)="newScene()">
              <app-roshar-icon key="aid" label="Add scene" tone="gold" [size]="14" />
              <span>Add scene</span>
            </button>
          </div>
        </div>

        @if (importPanelOpen()) {
          <section class="inset-panel stage-import-panel">
            <div class="stage-import-heading">
              <div>
                <p class="eyebrow">Reuse scenes</p>
                <h3>Import from another session</h3>
              </div>
              <button type="button" class="button-outline micro-button" (click)="closeImportPanel()">Close</button>
            </div>

            @if (sessionStore.loading() && !availableSourceSessions().length) {
              <p class="muted">Loading sessions...</p>
            } @else if (!availableSourceSessions().length) {
              <article class="empty-card stage-import-empty">No other sessions with stage scenes are available yet.</article>
            } @else {
              <form class="form-grid stage-import-form" [formGroup]="importForm">
                <label class="full-width">
                  <span>Source session</span>
                  <select formControlName="sourceSessionId">
                    <option value="">Select a session</option>
                    @for (session of availableSourceSessions(); track session.id) {
                      <option [value]="session.id">{{ session.title }} • {{ session.stageSceneCount }} scenes</option>
                    }
                  </select>
                </label>
              </form>

              @if (importSourceLoading()) {
                <p class="muted">Loading source scenes...</p>
              } @else if (importLoadError()) {
                <p class="import-message">{{ importLoadError() }}</p>
              } @else if (selectedImportSourceSession(); as sourceSession) {
                @if (importSourceScenes().length) {
                  <p class="editor-caption">Choose the draft scenes to append from <strong>{{ sourceSession.title }}</strong>. Imported scenes stay in draft and do not change the live display.</p>
                  <div class="stage-import-scene-list">
                    @for (scene of importSourceScenes(); track scene.id) {
                      <label class="stage-import-scene-row">
                        <input
                          type="checkbox"
                          [checked]="isImportSceneSelected(scene.id)"
                          [disabled]="importSubmitting()"
                          (change)="toggleImportScene(scene.id, $any($event.target).checked)"
                        />
                        <div class="scene-thumb" [style.background-image]="scene.backgroundImagePath ? 'url(' + scene.backgroundImagePath + ')' : 'none'"></div>
                        <div class="stage-import-scene-copy">
                          <strong>{{ scene.title }}</strong>
                          <small>#{{ scene.order }}</small>
                          @if (scene.gmNotes) {
                            <span>{{ scene.gmNotes }}</span>
                          } @else if (scene.youtubeUrl) {
                            <span>{{ scene.youtubeUrl }}</span>
                          } @else {
                            <span>No notes or media reference.</span>
                          }
                        </div>
                      </label>
                    }
                  </div>

                  @if (duplicateImportScenes().length) {
                    <article class="stage-import-warning">
                      <strong>{{ duplicateImportScenes().length }} selected scenes already match an existing title and background in this session.</strong>
                      <p>Importing is still allowed, but the copies will be appended as additional draft scenes.</p>
                      <small>{{ duplicateImportTitles().join(', ') }}</small>
                    </article>
                  }

                  <div class="button-row stage-import-actions">
                    <button type="button" class="button-outline" [disabled]="!selectedImportScenes().length || importSubmitting()" (click)="clearImportSelection()">
                      Clear selection
                    </button>
                    <button type="button" class="button-outline" [disabled]="importSubmitting()" (click)="closeImportPanel()">Cancel</button>
                    <button type="button" [disabled]="!canSubmitImport()" (click)="submitImport()">
                      {{ importSubmitting() ? 'Importing...' : importDuplicateConfirmationRequested() ? 'Confirm import' : 'Import selected scenes' }}
                    </button>
                  </div>

                  @if (importDuplicateConfirmationRequested()) {
                    <p class="muted stage-import-confirmation">Duplicate matches were found. Click <strong>Confirm import</strong> to append the selected scenes anyway.</p>
                  }

                  @if (importSubmitError()) {
                    <p class="import-message">{{ importSubmitError() }}</p>
                  }
                } @else {
                  <article class="empty-card stage-import-empty">This source session does not currently have any scenes to import.</article>
                }
              } @else {
                <article class="empty-card stage-import-empty">Choose a source session to review its available scenes.</article>
              }
            }
          </section>
        }

        <div class="list-stack">
          @for (scene of store.scenes(); track scene.id) {
            <button
              class="list-item-button scene-ledger"
              type="button"
              draggable="true"
              [class.active]="selectedSceneId() === scene.id"
              (click)="selectScene(scene)"
              (dragstart)="dragStart(scene.id)"
              (dragover)="allowDrop($event)"
              (drop)="dropOn(scene.id)"
            >
              <div class="scene-thumb" [style.background-image]="scene.backgroundImagePath ? 'url(' + scene.backgroundImagePath + ')' : 'none'"></div>
              <div>
                <strong class="event-line">
                  <app-roshar-icon key="stage" [label]="scene.title" tone="sapphire" [size]="16" />
                  {{ scene.title }}
                </strong>
                <small>#{{ scene.order }}</small>
              </div>
              <span class="tag-chip" [class.live-chip]="store.liveState()?.liveSceneId === scene.id">
                <app-roshar-icon [key]="store.liveState()?.liveSceneId === scene.id ? 'live' : 'chronicle'" [label]="store.liveState()?.liveSceneId === scene.id ? 'Live scene' : 'Draft scene'" [tone]="store.liveState()?.liveSceneId === scene.id ? 'emerald' : 'muted'" [size]="14" />
                {{ store.liveState()?.liveSceneId === scene.id ? 'Live' : 'Draft' }}
              </span>
            </button>
          } @empty {
            <article class="empty-card">No scenes in the cue deck yet. Add one, upload art, and publish only when the table is ready.</article>
          }
        </div>
      </section>

      <section class="card stage-preview engraved-panel" data-tour="stage-preview">
        <div class="card-header">
          <div class="section-heading">
            <app-roshar-icon key="live" label="Preview" tone="topaz" [size]="18" />
            <h3>Preview</h3>
          </div>
          <span class="pill">Live: {{ liveTitle() }}</span>
        </div>
        <div class="scene-preview stage-atmosphere" [style.background-image]="previewImage()"></div>
      </section>

      <section class="card engraved-panel" data-tour="stage-editor">
        <div class="card-header">
          <div class="section-heading">
            <app-roshar-icon key="chronicle" label="Scene editor" tone="gold" [size]="18" />
            <h3>Scene editor</h3>
          </div>
          <span class="pill">{{ selectedScene() ? 'Selected' : 'Draft' }}</span>
        </div>
        <div class="publish-state-bar">
          <span class="tag-chip">
            <app-roshar-icon key="chronicle" label="Editing" tone="topaz" [size]="14" />
            Editing: {{ selectedScene()?.title || 'New draft' }}
          </span>
          <span class="tag-chip live-chip">
            <app-roshar-icon key="live" label="Live scene" tone="emerald" [size]="14" />
            Live: {{ liveTitle() }}
          </span>
        </div>
        <form class="form-grid" [formGroup]="form" (ngSubmit)="save()">
          <label class="full-width">
            <span>Title</span>
            <input formControlName="title" type="text" />
          </label>
          <label class="full-width">
            <span>Background image</span>
            <input type="file" accept="image/*" (change)="upload($event)" />
          </label>
          @if (store.uploadFileName()) {
            <div class="full-width upload-status-row">
              <span class="tag-chip">
                <app-roshar-icon
                  key="chronicle"
                  label="Upload state"
                  [tone]="store.uploadState() === 'error' ? 'ruby' : store.uploadState() === 'uploaded' ? 'emerald' : 'topaz'"
                  [size]="14"
                />
                {{ store.uploadState() }}: {{ store.uploadFileName() }}
              </span>
              @if (store.uploadError()) {
                <span class="tag-chip shell-error-chip">{{ store.uploadError() }}</span>
              }
            </div>
          }
          <label class="full-width">
            <span>YouTube reference</span>
            <input formControlName="youtubeUrl" type="url" />
          </label>
          <label class="full-width">
            <span>GM notes</span>
            <textarea formControlName="gmNotes" rows="5"></textarea>
          </label>
          <div class="editor-action-groups full-width">
            <div class="editor-action-group">
              <p class="eyebrow">Save</p>
              <div class="button-row">
                <button type="submit" class="shell-shortcut">
                  <app-roshar-icon key="aid" label="Save scene" tone="gold" [size]="16" />
                  <span>Save scene</span>
                </button>
              </div>
            </div>
            <div class="editor-action-group">
              <p class="eyebrow">Scene management</p>
              <div class="button-row">
                <button type="button" class="button-outline shell-shortcut" [disabled]="!selectedScene()" (click)="duplicate()">
                  <app-roshar-icon key="chronicle" label="Duplicate" tone="topaz" [size]="16" />
                  <span>Duplicate</span>
                </button>
                <button type="button" class="button-outline shell-shortcut" [disabled]="!selectedScene()" (click)="move(-1)">
                  <app-roshar-icon key="fast" label="Move up" tone="topaz" [size]="16" />
                  <span>Move up</span>
                </button>
                <button type="button" class="button-outline shell-shortcut" [disabled]="!selectedScene()" (click)="move(1)">
                  <app-roshar-icon key="slow" label="Move down" tone="sapphire" [size]="16" />
                  <span>Move down</span>
                </button>
              </div>
            </div>
            <div class="editor-action-group editor-action-group-danger">
              <p class="eyebrow">Danger</p>
              <div class="button-row">
                <button type="button" class="button-outline button-danger shell-shortcut" [disabled]="!selectedScene()" (click)="remove()">
                  <app-roshar-icon key="damage" label="Delete" tone="ruby" [size]="16" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </section>
    </div>
  `,
})
export class StageManagerPageComponent {
  readonly store = inject(StageManagerStore);
  readonly sessionStore = inject(SessionStoreService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private importSourceRequestId = 0;

  readonly sessionId = signal('');
  readonly selectedSceneId = signal('');
  readonly dragSceneId = signal('');
  readonly importPanelOpen = signal(false);
  readonly importSourceSessionId = signal('');
  readonly importSourceScenes = signal<StageScene[]>([]);
  readonly importSourceLoading = signal(false);
  readonly importSubmitting = signal(false);
  readonly importLoadError = signal('');
  readonly importSubmitError = signal('');
  readonly selectedImportSceneIds = signal<string[]>([]);
  readonly importDuplicateConfirmationRequested = signal(false);

  readonly selectedScene = computed(() => this.store.scenes().find((scene) => scene.id === this.selectedSceneId()) ?? null);
  readonly liveTitle = computed(() => {
    const liveId = this.store.liveState()?.liveSceneId;
    return this.store.scenes().find((scene) => scene.id === liveId)?.title ?? 'Nothing live';
  });
  readonly previewImage = computed(() => {
    const scene = this.selectedScene();
    return scene?.backgroundImagePath ? `url(${scene.backgroundImagePath})` : 'none';
  });
  readonly availableSourceSessions = computed<SessionSummary[]>(() =>
    this.sessionStore.sessions().filter((session) => session.id !== this.sessionId() && session.stageSceneCount > 0),
  );
  readonly selectedImportSourceSession = computed(
    () => this.availableSourceSessions().find((session) => session.id === this.importSourceSessionId()) ?? null,
  );
  readonly selectedImportScenes = computed(() => {
    const selectedIds = new Set(this.selectedImportSceneIds());
    return this.importSourceScenes().filter((scene) => selectedIds.has(scene.id));
  });
  readonly duplicateImportScenes = computed(() => {
    const currentScenes = this.store.scenes();
    return this.selectedImportScenes().filter((scene) =>
      currentScenes.some(
        (currentScene) =>
          currentScene.title === scene.title && currentScene.backgroundImagePath === scene.backgroundImagePath,
      ),
    );
  });
  readonly duplicateImportTitles = computed(() => [...new Set(this.duplicateImportScenes().map((scene) => scene.title))]);
  readonly canSubmitImport = computed(
    () =>
      Boolean(
        this.importSourceSessionId() &&
          this.selectedImportScenes().length &&
          !this.importSourceLoading() &&
          !this.importSubmitting(),
      ),
  );

  readonly form = this.fb.nonNullable.group({
    title: ['New scene', Validators.required],
    backgroundImagePath: [''],
    youtubeUrl: [''],
    gmNotes: [''],
  });

  readonly importForm = this.fb.nonNullable.group({
    sourceSessionId: [''],
  });

  constructor() {
    const routeSub = this.route.paramMap.subscribe((params) => {
      const sessionId = params.get('sessionId');
      if (sessionId) {
        this.sessionId.set(sessionId);
        void this.store.load(sessionId).then(() => {
          const firstScene = this.store.scenes()[0];
          if (firstScene) {
            this.selectScene(firstScene);
          }
        });
      }
    });
    const importSourceSub = this.importForm.controls.sourceSessionId.valueChanges.subscribe((sourceSessionId) => {
      this.importSourceSessionId.set(sourceSessionId);
      void this.loadImportSourceScenes(sourceSessionId);
    });
    this.destroyRef.onDestroy(() => {
      routeSub.unsubscribe();
      importSourceSub.unsubscribe();
    });
  }

  selectScene(scene: StageScene): void {
    this.selectedSceneId.set(scene.id);
    this.form.patchValue({
      title: scene.title,
      backgroundImagePath: scene.backgroundImagePath,
      youtubeUrl: scene.youtubeUrl || '',
      gmNotes: scene.gmNotes || '',
    });
  }

  async save(): Promise<void> {
    const raw = this.form.getRawValue();
    if (this.selectedScene()) {
      await this.store.update(
        this.selectedScene()!.id,
        {
          title: raw.title,
          backgroundImagePath: raw.backgroundImagePath,
          youtubeUrl: raw.youtubeUrl || undefined,
          gmNotes: raw.gmNotes || undefined,
        },
        this.sessionId(),
      );
    } else {
      await this.store.create(this.sessionId(), {
        title: raw.title,
        backgroundImagePath: raw.backgroundImagePath,
        youtubeUrl: raw.youtubeUrl || undefined,
        gmNotes: raw.gmNotes || undefined,
        order: this.store.scenes().length + 1,
      });
    }
    const current = this.store.scenes().find((scene) => scene.id === this.selectedSceneId()) ?? this.store.scenes().at(-1);
    if (current) {
      this.selectScene(current);
    }
  }

  async upload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const backgroundImagePath = await this.store.uploadImage(this.sessionId(), file);
    this.form.patchValue({ backgroundImagePath });
  }

  newScene(): void {
    this.selectedSceneId.set('');
    this.form.reset({
      title: `Scene ${this.store.scenes().length + 1}`,
      backgroundImagePath: '',
      youtubeUrl: '',
      gmNotes: '',
    });
  }

  async duplicate(): Promise<void> {
    const scene = this.selectedScene();
    if (!scene) {
      return;
    }
    await this.store.create(this.sessionId(), {
      title: `${scene.title} Copy`,
      backgroundImagePath: scene.backgroundImagePath,
      youtubeUrl: scene.youtubeUrl,
      gmNotes: scene.gmNotes,
      order: this.store.scenes().length + 1,
    });
  }

  async move(delta: number): Promise<void> {
    const scene = this.selectedScene();
    if (!scene) {
      return;
    }
    const scenes = this.store.scenes();
    const index = scenes.findIndex((entry) => entry.id === scene.id);
    const target = scenes[index + delta];
    if (!target) {
      return;
    }
    await Promise.all([
      this.store.update(scene.id, { order: target.order }, this.sessionId()),
      this.store.update(target.id, { order: scene.order }, this.sessionId()),
    ]);
  }

  async remove(): Promise<void> {
    if (!this.selectedScene()) {
      return;
    }
    await this.store.delete(this.selectedScene()!.id, this.sessionId());
    this.newScene();
  }

  async publish(): Promise<void> {
    await this.store.publish(this.sessionId(), this.selectedScene()?.id ?? null);
  }

  openDisplay(): void {
    window.open(`/display/${this.sessionId()}`, '_blank');
  }

  openFullscreenDisplay(): void {
    window.open(`/display/${this.sessionId()}`, 'cosmere-player-display', 'popup=yes,width=1600,height=900');
  }

  toggleImportPanel(): void {
    if (this.importPanelOpen()) {
      this.closeImportPanel();
      return;
    }
    this.importPanelOpen.set(true);
    this.importLoadError.set('');
    this.importSubmitError.set('');
    void this.sessionStore.loadSessions();
  }

  closeImportPanel(): void {
    this.importPanelOpen.set(false);
    this.resetImportSelectionState();
    this.importLoadError.set('');
    this.importSubmitError.set('');
    this.importSourceScenes.set([]);
    this.importSourceLoading.set(false);
    this.importForm.reset({ sourceSessionId: '' });
  }

  clearImportSelection(): void {
    this.resetImportSelectionState();
  }

  isImportSceneSelected(sceneId: string): boolean {
    return this.selectedImportSceneIds().includes(sceneId);
  }

  toggleImportScene(sceneId: string, checked: boolean): void {
    this.importDuplicateConfirmationRequested.set(false);
    this.selectedImportSceneIds.update((sceneIds) => {
      if (checked) {
        return sceneIds.includes(sceneId) ? sceneIds : [...sceneIds, sceneId];
      }
      return sceneIds.filter((id) => id !== sceneId);
    });
  }

  async submitImport(): Promise<void> {
    if (!this.canSubmitImport()) {
      return;
    }

    if (this.duplicateImportScenes().length && !this.importDuplicateConfirmationRequested()) {
      this.importDuplicateConfirmationRequested.set(true);
      return;
    }

    this.importSubmitting.set(true);
    this.importSubmitError.set('');
    const sourceSessionId = this.importSourceSessionId();
    try {
      const result = await this.store.importScenes(this.sessionId(), {
        sourceSessionId,
        sourceSceneIds: this.selectedImportScenes().map((scene) => scene.id),
      });
      const firstImportedId = result.importedScenes[0]?.id;
      this.closeImportPanel();
      if (firstImportedId) {
        const importedScene = this.store.scenes().find((scene) => scene.id === firstImportedId);
        if (importedScene) {
          this.selectScene(importedScene);
        }
      }
    } catch (error) {
      this.importSubmitError.set(error instanceof Error ? error.message : 'Stage import failed.');
    } finally {
      this.importSubmitting.set(false);
    }
  }

  dragStart(sceneId: string): void {
    this.dragSceneId.set(sceneId);
  }

  allowDrop(event: DragEvent): void {
    event.preventDefault();
  }

  async dropOn(targetSceneId: string): Promise<void> {
    const sourceSceneId = this.dragSceneId();
    this.dragSceneId.set('');
    if (!sourceSceneId || sourceSceneId === targetSceneId) {
      return;
    }
    const orderedIds = this.store.scenes().map((scene) => scene.id);
    const sourceIndex = orderedIds.indexOf(sourceSceneId);
    const targetIndex = orderedIds.indexOf(targetSceneId);
    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }
    orderedIds.splice(targetIndex, 0, orderedIds.splice(sourceIndex, 1)[0]!);
    await this.store.reorder(this.sessionId(), orderedIds);
  }

  private async loadImportSourceScenes(sourceSessionId: string): Promise<void> {
    this.importSourceRequestId += 1;
    const requestId = this.importSourceRequestId;
    this.resetImportSelectionState();
    this.importLoadError.set('');
    this.importSubmitError.set('');

    if (!sourceSessionId) {
      this.importSourceScenes.set([]);
      this.importSourceLoading.set(false);
      return;
    }

    this.importSourceLoading.set(true);
    try {
      const scenes = await this.store.listSessionScenes(sourceSessionId);
      if (requestId !== this.importSourceRequestId) {
        return;
      }
      this.importSourceScenes.set([...scenes].sort((left, right) => left.order - right.order));
    } catch (error) {
      if (requestId !== this.importSourceRequestId) {
        return;
      }
      this.importSourceScenes.set([]);
      this.importLoadError.set(error instanceof Error ? error.message : 'Failed to load source scenes.');
    } finally {
      if (requestId === this.importSourceRequestId) {
        this.importSourceLoading.set(false);
      }
    }
  }

  private resetImportSelectionState(): void {
    this.selectedImportSceneIds.set([]);
    this.importDuplicateConfirmationRequested.set(false);
  }
}
