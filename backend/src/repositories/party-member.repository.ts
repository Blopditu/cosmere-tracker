import path from 'node:path';
import { PartyMember } from '@shared/domain';
import { JsonCollectionRepository } from '../lib/json-store';

export class PartyMemberRepository extends JsonCollectionRepository<PartyMember> {
  constructor(dataDir: string) {
    super(path.join(dataDir, 'party-members.json'), []);
  }
}
