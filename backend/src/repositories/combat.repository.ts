import path from 'node:path';
import { CombatRecord } from '@shared/domain';
import { AsyncSqliteJsonRepository } from '../lib/sqlite';

export class CombatRepository extends AsyncSqliteJsonRepository<CombatRecord> {
  constructor(dataDir: string) {
    super(
      path.join(dataDir, 'cosmere-tracker.sqlite'),
      'combats',
      path.join(dataDir, 'combats.json'),
      [],
    );
  }
}
