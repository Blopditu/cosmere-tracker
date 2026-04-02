import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CombatRepository } from '../repositories/combat.repository';
import { LiveStageRepository } from '../repositories/live-stage.repository';
import { ParticipantTemplateRepository } from '../repositories/participant-template.repository';
import { PartyMemberRepository } from '../repositories/party-member.repository';
import { RollRepository } from '../repositories/roll.repository';
import { SessionRepository } from '../repositories/session.repository';
import { StageSceneRepository } from '../repositories/stage-scene.repository';
import { SessionService } from './session.service';

describe('SessionService campaign roster preset actions', () => {
  let dataDir: string;
  let sessionService: SessionService;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'cosmere-session-service-'));
    sessionService = new SessionService(
      new SessionRepository(dataDir),
      new PartyMemberRepository(dataDir),
      new ParticipantTemplateRepository(dataDir),
      new RollRepository(dataDir),
      new CombatRepository(dataDir),
      new StageSceneRepository(dataDir),
      new LiveStageRepository(dataDir),
    );
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it('persists enemy preset actions through campaign roster saves and loads', async () => {
    await sessionService.updateCampaignRoster({
      partyMembers: [],
      participantTemplates: [
        {
          id: 'guard-template',
          name: 'Hallway Guard',
          side: 'enemy',
          role: 'Bruiser',
          maxHealth: 24,
          maxFocus: 4,
          presetActions: [
            {
              id: 'guard-debilitate',
              name: 'Debilitate',
              kind: 'action',
              actionCost: 1,
              focusCost: 2,
              requiresTarget: true,
              requiresRoll: true,
              supportsDamage: true,
              defaultModifier: 5,
              defaultDamageFormula: '2d8 + 5',
            },
            {
              id: 'guard-stand-fast',
              name: 'Stand Fast',
              kind: 'reaction',
              actionCost: 0,
              focusCost: 1,
              requiresTarget: false,
              requiresRoll: false,
              supportsDamage: false,
            },
          ],
        },
      ],
    });

    const roster = await sessionService.campaignRoster();
    const template = roster.participantTemplates[0];

    expect(template?.presetActions).toHaveLength(2);
    expect(template?.presetActions[0]?.name).toBe('Debilitate');
    expect(template?.presetActions[0]?.defaultModifier).toBe(5);
    expect(template?.presetActions[1]?.kind).toBe('reaction');
  });
});
