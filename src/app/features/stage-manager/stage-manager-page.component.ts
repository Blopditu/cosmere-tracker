import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { StageScene } from '@shared/domain';
import { StageManagerStore } from './stage-manager.store';

@Component({
  selector: 'app-stage-manager-page',
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Stage manager</p>
        <h2>Spoiler-safe player display</h2>
        <p>Editing scenes never changes the player display. Only the publish button updates the live screen.</p>
      </div>
      <div class="button-row">
        <button type="button" (click)="openDisplay()">Open player display</button>
        <button type="button" class="button-outline" [disabled]="!selectedScene()" (click)="publish()">Go live</button>
      </div>
    </section>

    <div class="stage-grid">
      <section class="card">
        <div class="card-header">
          <h3>Scenes</h3>
          <button type="button" class="button-outline" (click)="newScene()">Add scene</button>
        </div>
        <div class="list-stack">
          @for (scene of store.scenes(); track scene.id) {
            <button class="list-item-button" type="button" [class.active]="selectedSceneId() === scene.id" (click)="selectScene(scene)">
              <span>{{ scene.title }}</span>
              <span>#{{ scene.order }}</span>
            </button>
          }
        </div>
      </section>

      <section class="card stage-preview">
        <div class="card-header">
          <h3>Preview</h3>
          <span class="pill">Live: {{ liveTitle() }}</span>
        </div>
        <div class="scene-preview" [style.background-image]="previewImage()"></div>
      </section>

      <section class="card">
        <div class="card-header">
          <h3>Scene editor</h3>
          <span class="pill">{{ selectedScene() ? 'Selected' : 'Draft' }}</span>
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
          <label class="full-width">
            <span>YouTube reference</span>
            <input formControlName="youtubeUrl" type="url" />
          </label>
          <label class="full-width">
            <span>GM notes</span>
            <textarea formControlName="gmNotes" rows="5"></textarea>
          </label>
          <div class="button-row full-width">
            <button type="submit">Save scene</button>
            <button type="button" class="button-outline" [disabled]="!selectedScene()" (click)="duplicate()">Duplicate</button>
            <button type="button" class="button-outline" [disabled]="!selectedScene()" (click)="move(-1)">Move up</button>
            <button type="button" class="button-outline" [disabled]="!selectedScene()" (click)="move(1)">Move down</button>
            <button type="button" class="button-outline button-danger" [disabled]="!selectedScene()" (click)="remove()">Delete</button>
          </div>
        </form>
      </section>
    </div>
  `,
})
export class StageManagerPageComponent {
  readonly store = inject(StageManagerStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  readonly sessionId = signal('');
  readonly selectedSceneId = signal('');
  readonly selectedScene = computed(() => this.store.scenes().find((scene) => scene.id === this.selectedSceneId()) ?? null);
  readonly liveTitle = computed(() => {
    const liveId = this.store.liveState()?.liveSceneId;
    return this.store.scenes().find((scene) => scene.id === liveId)?.title ?? 'Nothing live';
  });
  readonly previewImage = computed(() => {
    const scene = this.selectedScene();
    return scene?.backgroundImagePath ? `url(${scene.backgroundImagePath})` : 'none';
  });

  readonly form = this.fb.nonNullable.group({
    title: ['New scene', Validators.required],
    backgroundImagePath: [''],
    youtubeUrl: [''],
    gmNotes: [''],
  });

  constructor() {
    const sub = this.route.paramMap.subscribe((params) => {
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
    this.destroyRef.onDestroy(() => sub.unsubscribe());
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
}
