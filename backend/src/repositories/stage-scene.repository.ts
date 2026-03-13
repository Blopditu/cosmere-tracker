import path from 'node:path';
import { StageScene } from '@shared/domain';
import { JsonCollectionRepository } from '../lib/json-store';

export class StageSceneRepository extends JsonCollectionRepository<StageScene> {
  constructor(dataDir: string) {
    super(path.join(dataDir, 'stage-scenes.json'), []);
  }
}
