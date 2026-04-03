import { createEmptyCharacterStatSheet } from '@shared/domain';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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
  let sessionRepository: SessionRepository;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'cosmere-session-service-'));
    sessionRepository = new SessionRepository(dataDir);
    sessionService = new SessionService(
      sessionRepository,
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
          stats: createEmptyCharacterStatSheet(),
          maxHealth: 24,
          maxFocus: 4,
          features: ['Shield Wall', 'Veteran discipline'],
          tactics: 'Advance with the frontline, then hold ground once engaged.',
          sourceAdversaryName: 'Hallway Guard',
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
              rangeText: 'reach 5 ft.',
              description: 'Attack +5, reach 5 ft., one target. Graze ... Hit ...',
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
    expect(template?.presetActions[0]?.rangeText).toBe('reach 5 ft.');
    expect(template?.presetActions[0]?.description).toContain('Attack +5');
    expect(template?.presetActions[1]?.kind).toBe('reaction');
    expect(template?.features).toEqual(['Shield Wall', 'Veteran discipline']);
    expect(template?.tactics).toContain('Advance with the frontline');
    expect(template?.sourceAdversaryName).toBe('Hallway Guard');
  });

  it('migrates legacy embedded roster entries into stat sheets without losing resource maxima', async () => {
    const timestamp = '2026-04-02T12:00:00.000Z';
    await sessionRepository.upsert({
      id: 'legacy-session',
      title: 'Legacy Session',
      createdAt: timestamp,
      updatedAt: timestamp,
      playerIds: ['legacy-pc'],
      partyMembers: [
        {
          id: 'legacy-pc',
          name: 'Legacy Kaladin',
          side: 'pc',
          maxHealth: 17,
          maxFocus: 6,
        },
      ],
      participantTemplates: [
        {
          id: 'legacy-enemy',
          name: 'Legacy Guard',
          side: 'enemy',
          maxHealth: 22,
          maxFocus: 3,
          maxInvestiture: 1,
          presetActions: [],
        },
      ],
    } as never);

    const roster = await sessionService.campaignRoster();
    const legacyMember = roster.partyMembers.find((member) => member.id === 'legacy-pc');
    const legacyEnemy = roster.participantTemplates.find((template) => template.id === 'legacy-enemy');

    expect(legacyMember?.stats.resourceOverrides.health).toBe(17);
    expect(legacyMember?.stats.resourceOverrides.focus).toBe(6);
    expect(legacyMember?.maxHealth).toBe(17);
    expect(legacyMember?.maxFocus).toBe(6);
    expect(legacyEnemy?.stats.resourceOverrides.health).toBe(22);
    expect(legacyEnemy?.stats.resourceOverrides.focus).toBe(3);
    expect(legacyEnemy?.stats.resourceOverrides.investiture).toBe(1);
    expect(legacyEnemy?.maxInvestiture).toBe(1);
  });

  it('backfills sessions and campaign roster from legacy JSON once, then keeps SQLite as source of truth', async () => {
    const timestamp = '2026-04-03T10:00:00.000Z';
    await writeFile(
      path.join(dataDir, 'sessions.json'),
      JSON.stringify(
        [
          {
            id: 'legacy-session',
            title: 'Legacy Session',
            notes: '',
            createdAt: timestamp,
            updatedAt: timestamp,
            playerIds: ['legacy-player'],
          },
        ],
        null,
        2,
      ),
      'utf8',
    );
    await writeFile(
      path.join(dataDir, 'party-members.json'),
      JSON.stringify(
        [
          {
            id: 'legacy-player',
            name: 'Rockefeller',
            side: 'pc',
            stats: createEmptyCharacterStatSheet(),
            maxHealth: 12,
            maxFocus: 3,
          },
        ],
        null,
        2,
      ),
      'utf8',
    );
    await writeFile(
      path.join(dataDir, 'participant-templates.json'),
      JSON.stringify(
        [
          {
            id: 'legacy-enemy',
            name: 'Legacy Archer',
            side: 'enemy',
            stats: createEmptyCharacterStatSheet(),
            presetActions: [],
            features: [],
          },
        ],
        null,
        2,
      ),
      'utf8',
    );

    const firstRoster = await sessionService.campaignRoster();
    const firstDashboard = await sessionService.dashboard('legacy-session');

    expect(firstRoster.partyMembers.map((member) => member.name)).toEqual(['Rockefeller']);
    expect(firstRoster.participantTemplates.map((template) => template.name)).toEqual(['Legacy Archer']);
    expect(firstDashboard.campaignPartyMembers.map((member) => member.name)).toEqual(['Rockefeller']);
    expect(firstDashboard.session.partyMembers.map((member) => member.name)).toEqual(['Rockefeller']);

    await writeFile(path.join(dataDir, 'party-members.json'), JSON.stringify([], null, 2), 'utf8');
    await writeFile(path.join(dataDir, 'participant-templates.json'), JSON.stringify([], null, 2), 'utf8');
    await writeFile(path.join(dataDir, 'sessions.json'), JSON.stringify([], null, 2), 'utf8');

    const secondRoster = await sessionService.campaignRoster();
    const secondDashboard = await sessionService.dashboard('legacy-session');

    expect(secondRoster.partyMembers.map((member) => member.name)).toEqual(['Rockefeller']);
    expect(secondRoster.participantTemplates.map((template) => template.name)).toEqual(['Legacy Archer']);
    expect(secondDashboard.session.partyMembers.map((member) => member.name)).toEqual(['Rockefeller']);
  });
});
