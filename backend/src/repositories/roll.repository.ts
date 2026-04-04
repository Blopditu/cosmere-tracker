import path from 'node:path';
import { RollEvent } from '@shared/domain';
import { AsyncSqliteJsonRepository } from '../lib/sqlite';

export class RollRepository extends AsyncSqliteJsonRepository<RollEvent> {
  constructor(dataDir: string) {
    super(
      path.join(dataDir, 'cosmere-tracker.sqlite'),
      'rolls',
      path.join(dataDir, 'rolls.json'),
      [],
    );
  }
}
