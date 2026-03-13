import path from 'node:path';
import { RollEvent } from '@shared/domain';
import { JsonCollectionRepository } from '../lib/json-store';

export class RollRepository extends JsonCollectionRepository<RollEvent> {
  constructor(dataDir: string) {
    super(path.join(dataDir, 'rolls.json'), []);
  }
}
