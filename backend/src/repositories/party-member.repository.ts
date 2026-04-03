import path from 'node:path';
import { PartyMember } from '@shared/domain';
import { AsyncSqliteJsonRepository } from '../lib/sqlite';

export class PartyMemberRepository extends AsyncSqliteJsonRepository<PartyMember> {
  constructor(dataDir: string) {
    super(
      path.join(dataDir, 'cosmere-tracker.sqlite'),
      'party_members',
      path.join(dataDir, 'party-members.json'),
      [],
    );
  }
}
