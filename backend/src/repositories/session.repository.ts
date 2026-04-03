import path from 'node:path';
import { SessionEntity } from '@shared/domain';
import { AsyncSqliteJsonRepository } from '../lib/sqlite';

export class SessionRepository extends AsyncSqliteJsonRepository<SessionEntity> {
  constructor(dataDir: string) {
    super(
      path.join(dataDir, 'cosmere-tracker.sqlite'),
      'sessions',
      path.join(dataDir, 'sessions.json'),
      [],
    );
  }
}
