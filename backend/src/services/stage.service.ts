import { randomUUID } from 'node:crypto';
import { ImportStageScenesInput, ImportStageScenesResult, LiveStageState, StageScene } from '@shared/domain';
import { HttpError } from '../lib/http';
import { nowIso } from '../lib/time';
import { LiveStageRepository } from '../repositories/live-stage.repository';
import { SessionRepository } from '../repositories/session.repository';
import { StageSceneRepository } from '../repositories/stage-scene.repository';

export class StageService {
  constructor(
    private readonly sessionRepository: SessionRepository,
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
    const session = await this.sessionRepository.get(sessionId);
    if (!session) {
      throw new HttpError(404, 'Session not found.');
    }
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

  async importScenes(sessionId: string, input: ImportStageScenesInput): Promise<ImportStageScenesResult> {
    const sourceSessionId = String(input.sourceSessionId || '').trim();
    const sourceSceneIds = Array.isArray(input.sourceSceneIds)
      ? input.sourceSceneIds.map((sceneId) => String(sceneId || '').trim()).filter(Boolean)
      : [];

    if (!sourceSessionId) {
      throw new HttpError(400, 'Source session is required.');
    }

    if (sourceSessionId === sessionId) {
      throw new HttpError(400, 'Source and target sessions must differ.');
    }

    if (!sourceSceneIds.length) {
      throw new HttpError(400, 'Select at least one source scene.');
    }

    const [targetSession, sourceSession] = await Promise.all([
      this.sessionRepository.get(sessionId),
      this.sessionRepository.get(sourceSessionId),
    ]);

    if (!targetSession || !sourceSession) {
      throw new HttpError(404, 'Session not found.');
    }

    const scenes = await this.stageSceneRepository.list();
    const sourceScenes = scenes
      .filter((scene) => scene.sessionId === sourceSessionId)
      .sort((left, right) => left.order - right.order);
    const targetScenes = scenes.filter((scene) => scene.sessionId === sessionId);
    const selectedSceneIds = new Set(sourceSceneIds);
    const selectedSourceScenes = sourceScenes.filter((scene) => selectedSceneIds.has(scene.id));

    if (selectedSourceScenes.length !== selectedSceneIds.size) {
      throw new HttpError(400, 'One or more selected source scenes could not be found.');
    }

    const timestamp = nowIso();
    const maxOrder = targetScenes.reduce((highest, scene) => Math.max(highest, scene.order), 0);
    const importedScenes = selectedSourceScenes.map((scene, index) => ({
      ...scene,
      id: randomUUID(),
      sessionId,
      order: maxOrder + index + 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));

    await this.stageSceneRepository.saveAll([...scenes, ...importedScenes]);
    return { importedScenes };
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
