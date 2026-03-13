import { randomUUID } from 'node:crypto';
import { LiveStageState, StageScene } from '@shared/domain';
import { HttpError } from '../lib/http';
import { nowIso } from '../lib/time';
import { LiveStageRepository } from '../repositories/live-stage.repository';
import { StageSceneRepository } from '../repositories/stage-scene.repository';

export class StageService {
  constructor(
    private readonly stageSceneRepository: StageSceneRepository,
    private readonly liveStageRepository: LiveStageRepository,
  ) {}

  async listScenes(sessionId: string): Promise<StageScene[]> {
    return (await this.stageSceneRepository.list())
      .filter((scene) => scene.sessionId === sessionId)
      .sort((left, right) => left.order - right.order);
  }

  async createScene(
    sessionId: string,
    input: Pick<StageScene, 'title' | 'backgroundImagePath' | 'youtubeUrl' | 'gmNotes' | 'order'>,
  ): Promise<StageScene> {
    const scene: StageScene = {
      id: randomUUID(),
      sessionId,
      title: input.title.trim(),
      backgroundImagePath: input.backgroundImagePath,
      youtubeUrl: input.youtubeUrl?.trim(),
      gmNotes: input.gmNotes?.trim(),
      order: input.order,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await this.stageSceneRepository.upsert(scene);
    return scene;
  }

  async updateScene(sceneId: string, patch: Partial<StageScene>): Promise<StageScene> {
    const scene = await this.stageSceneRepository.get(sceneId);
    if (!scene) {
      throw new HttpError(404, 'Scene not found.');
    }
    const next: StageScene = {
      ...scene,
      ...patch,
      updatedAt: nowIso(),
    };
    await this.stageSceneRepository.upsert(next);
    return next;
  }

  async deleteScene(sceneId: string): Promise<void> {
    await this.stageSceneRepository.remove(sceneId);
  }

  async getLiveState(sessionId: string): Promise<LiveStageState> {
    return (
      (await this.liveStageRepository.get(sessionId)) ?? {
        sessionId,
        liveSceneId: null,
        updatedAt: nowIso(),
      }
    );
  }

  async publishScene(sessionId: string, liveSceneId: string | null): Promise<LiveStageState> {
    const state = {
      sessionId,
      liveSceneId,
      updatedAt: nowIso(),
    };
    await this.liveStageRepository.upsert(state);
    return state;
  }

  async deleteBySession(sessionId: string): Promise<void> {
    const scenes = await this.stageSceneRepository.list();
    await Promise.all([
      this.stageSceneRepository.saveAll(scenes.filter((scene) => scene.sessionId !== sessionId)),
      this.liveStageRepository.remove(sessionId),
    ]);
  }
}
