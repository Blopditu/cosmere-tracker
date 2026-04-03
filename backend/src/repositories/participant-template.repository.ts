import path from 'node:path';
import { ParticipantTemplate } from '@shared/domain';
import { AsyncSqliteJsonRepository } from '../lib/sqlite';

export class ParticipantTemplateRepository extends AsyncSqliteJsonRepository<ParticipantTemplate> {
  constructor(dataDir: string) {
    super(
      path.join(dataDir, 'cosmere-tracker.sqlite'),
      'participant_templates',
      path.join(dataDir, 'participant-templates.json'),
      [],
    );
  }
}
