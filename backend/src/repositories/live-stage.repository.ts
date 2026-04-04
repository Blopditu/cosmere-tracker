import path from 'node:path';
import { LiveStageState } from '@shared/domain';
import { AsyncSqliteKeyedJsonRepository } from '../lib/sqlite';

const LIVE_STAGE_KEY_SELECTOR = (state: LiveStageState): string => state.sessionId;

export class LiveStageRepository extends AsyncSqliteKeyedJsonRepository<LiveStageState> {
  constructor(dataDir: string) {
    super(
      path.join(dataDir, 'cosmere-tracker.sqlite'),
      'live_stage_states',
      LIVE_STAGE_KEY_SELECTOR,
      path.join(dataDir, 'live-stage-state.json'),
      [],
    );
  }
}
