import path from 'node:path';
import { StageScene } from '@shared/domain';
import { AsyncSqliteJsonRepository } from '../lib/sqlite';

export class StageSceneRepository extends AsyncSqliteJsonRepository<StageScene> {
  constructor(dataDir: string) {
    super(
      path.join(dataDir, 'cosmere-tracker.sqlite'),
      'stage_scenes',
      path.join(dataDir, 'stage-scenes.json'),
      [],
    );
  }
}
