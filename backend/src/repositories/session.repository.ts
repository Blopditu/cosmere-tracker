import path from 'node:path';
import { SessionEntity } from '@shared/domain';
import { JsonCollectionRepository } from '../lib/json-store';

export class SessionRepository extends JsonCollectionRepository<SessionEntity> {
  constructor(dataDir: string) {
    super(path.join(dataDir, 'sessions.json'), []);
  }
}
