import { Injectable, signal } from '@angular/core';
import { LiveStageState, StageScene } from '@shared/domain';
import { ApiService } from '../../core/api.service';

@Injectable({
  providedIn: 'root',
})
export class StageManagerStore {
  readonly scenes = signal<StageScene[]>([]);
  readonly liveState = signal<LiveStageState | null>(null);
  readonly loading = signal(false);

  constructor(private readonly api: ApiService) {}

  async load(sessionId: string): Promise<void> {
    this.loading.set(true);
    try {
      const [scenes, liveState] = await Promise.all([
        this.api.get<StageScene[]>(`/api/sessions/${sessionId}/stage-scenes`),
        this.api.get<LiveStageState>(`/api/sessions/${sessionId}/live-stage`),
      ]);
      this.scenes.set(scenes);
      this.liveState.set(liveState);
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
  }

  async uploadImage(sessionId: string, file: File): Promise<string> {
    const formData = new FormData();
    formData.append('sessionId', sessionId);
    formData.append('image', file);
    const response = await this.api.upload<{ backgroundImagePath: string }>('/api/uploads/stage-background', formData);
    return response.backgroundImagePath;
  }
}
