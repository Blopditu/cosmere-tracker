import { Injectable, signal } from '@angular/core';
import { LiveStageState, StageScene } from '@shared/domain';
import { ApiService } from '../../core/api.service';
import { AppRuntimeService } from '../../core/app-runtime.service';

@Injectable({
  providedIn: 'root',
})
export class StageManagerStore {
  readonly scenes = signal<StageScene[]>([]);
  readonly liveState = signal<LiveStageState | null>(null);
  readonly loading = signal(false);
  readonly uploadState = signal<'idle' | 'uploading' | 'uploaded' | 'error'>('idle');
  readonly uploadFileName = signal('');
  readonly uploadError = signal<string | null>(null);

  constructor(
    private readonly api: ApiService,
    private readonly runtime: AppRuntimeService,
  ) {}

  async load(sessionId: string): Promise<void> {
    this.loading.set(true);
    try {
      const [scenes, liveState] = await Promise.all([
        this.api.get<StageScene[]>(`/api/sessions/${sessionId}/stage-scenes`),
        this.api.get<LiveStageState>(`/api/sessions/${sessionId}/live-stage`),
      ]);
      this.scenes.set(scenes);
      this.liveState.set(liveState);
      this.uploadState.set('idle');
      const liveTitle = scenes.find((scene) => scene.id === liveState.liveSceneId)?.title ?? null;
      this.runtime.resetLiveScene(sessionId, liveTitle);
    } finally {
      this.loading.set(false);
    }
  }

  async create(sessionId: string, scene: Pick<StageScene, 'title' | 'backgroundImagePath' | 'youtubeUrl' | 'gmNotes' | 'order'>): Promise<void> {
    await this.api.post(`/api/sessions/${sessionId}/stage-scenes`, scene);
    await this.load(sessionId);
  }

  async update(sceneId: string, patch: Partial<StageScene>, sessionId: string): Promise<void> {
    await this.api.patch(`/api/stage-scenes/${sceneId}`, patch);
    await this.load(sessionId);
  }

  async delete(sceneId: string, sessionId: string): Promise<void> {
    await this.api.delete(`/api/stage-scenes/${sceneId}`);
    await this.load(sessionId);
  }

  async publish(sessionId: string, liveSceneId: string | null): Promise<void> {
    this.liveState.set(await this.api.put<LiveStageState>(`/api/sessions/${sessionId}/live-stage`, { liveSceneId }));
    const liveTitle = this.scenes().find((scene) => scene.id === liveSceneId)?.title ?? null;
    this.runtime.resetLiveScene(sessionId, liveTitle);
  }

  async uploadImage(sessionId: string, file: File): Promise<string> {
    this.uploadState.set('uploading');
    this.uploadFileName.set(file.name);
    this.uploadError.set(null);
    const formData = new FormData();
    formData.append('sessionId', sessionId);
    formData.append('image', file);
    try {
      const response = await this.api.upload<{ backgroundImagePath: string }>('/api/uploads/stage-background', formData);
      this.uploadState.set('uploaded');
      return response.backgroundImagePath;
    } catch (error) {
      this.uploadState.set('error');
      this.uploadError.set(error instanceof Error ? error.message : 'Image upload failed.');
      throw error;
    }
  }

  async reorder(sessionId: string, orderedSceneIds: string[]): Promise<void> {
    const scenes = this.scenes();
    const updates = orderedSceneIds
      .map((sceneId, index) => {
        const scene = scenes.find((entry) => entry.id === sceneId);
        if (!scene) {
          return null;
        }
        return this.api.patch(`/api/stage-scenes/${sceneId}`, { order: index + 1 });
      })
      .filter((request): request is Promise<unknown> => Boolean(request));
    await Promise.all(updates);
    await this.load(sessionId);
  }
}
