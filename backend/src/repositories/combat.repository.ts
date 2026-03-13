import path from 'node:path';
import { CombatRecord } from '@shared/domain';
import { JsonCollectionRepository } from '../lib/json-store';

export class CombatRepository extends JsonCollectionRepository<CombatRecord> {
  constructor(dataDir: string) {
    super(path.join(dataDir, 'combats.json'), []);
  }
}
