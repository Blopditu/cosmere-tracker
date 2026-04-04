import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LiveStageRepository } from '../repositories/live-stage.repository';
import { SessionRepository } from '../repositories/session.repository';
import { StageSceneRepository } from '../repositories/stage-scene.repository';
import { StageService } from './stage.service';

describe('StageService SQLite backfill', () => {
  let dataDir: string;
  let stageService: StageService;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'cosmere-stage-service-'));
    stageService = new StageService(
      new SessionRepository(dataDir),
      new StageSceneRepository(dataDir),
      new LiveStageRepository(dataDir),
    );
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it('backfills stage scenes and live state from legacy JSON once, then keeps SQLite as source of truth', async () => {
    const timestamp = '2026-04-04T10:00:00.000Z';
    await writeFile(
      path.join(dataDir, 'stage-scenes.json'),
      JSON.stringify(
        [
          {
            id: 'scene-1',
            sessionId: 'session-1',
            title: 'Opening Plaza',
            backgroundImagePath: '',
            youtubeUrl: undefined,
            gmNotes: 'Crowd chatter',
            order: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
        null,
        2,
      ),
      'utf8',
    );
    await writeFile(
      path.join(dataDir, 'live-stage-state.json'),
      JSON.stringify(
        [
          {
            sessionId: 'session-1',
            liveSceneId: 'scene-1',
            updatedAt: timestamp,
          },
        ],
        null,
        2,
      ),
      'utf8',
    );

    const initialScenes = await stageService.listScenes('session-1');
    const initialLiveState = await stageService.getLiveState('session-1');

    expect(initialScenes.map((scene) => scene.title)).toEqual(['Opening Plaza']);
    expect(initialLiveState.liveSceneId).toBe('scene-1');

    await writeFile(path.join(dataDir, 'stage-scenes.json'), JSON.stringify([], null, 2), 'utf8');
    await writeFile(path.join(dataDir, 'live-stage-state.json'), JSON.stringify([], null, 2), 'utf8');

    const persistedScenes = await stageService.listScenes('session-1');
    const persistedLiveState = await stageService.getLiveState('session-1');

    expect(persistedScenes.map((scene) => scene.title)).toEqual(['Opening Plaza']);
    expect(persistedLiveState.liveSceneId).toBe('scene-1');

    await stageService.publishScene('session-1', null);
    const updatedLiveState = await stageService.getLiveState('session-1');
    expect(updatedLiveState.liveSceneId).toBeNull();
  });
});
