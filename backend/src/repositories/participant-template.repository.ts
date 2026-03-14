import path from 'node:path';
import { ParticipantTemplate } from '@shared/domain';
import { JsonCollectionRepository } from '../lib/json-store';

export class ParticipantTemplateRepository extends JsonCollectionRepository<ParticipantTemplate> {
  constructor(dataDir: string) {
    super(path.join(dataDir, 'participant-templates.json'), []);
  }
}
