import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  ActionDefinition,
  Campaign,
  Chapter,
  ChapterState,
  Condition,
  DiceRoll,
  EncounterSetup,
  Endeavor,
  EndeavorRun,
  EventLogEntry,
  Favor,
  Hook,
  Location,
  NPC,
  NPCAppearance,
  Obstacle,
  Outcome,
  PC,
  PCGoal,
  ResolutionHook,
  ResourceDefinition,
  Reward,
  RuleReference,
  SceneEdge,
  SceneNode,
  SceneState,
  SessionRun,
  SkillDefinition,
  SimulationDefinition,
  SimulationResult,
  StatisticDefinition,
  StatisticTableDefinition,
} from '@shared/domain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openSqliteDatabase, SqliteJsonRepository } from '../lib/sqlite';
import { CampaignConsoleService } from './campaign-console.service';
import { RulesEngineService } from './rules-engine.service';
import { SimulationService } from './simulation.service';

describe('CampaignConsoleService scene view mutations', () => {
  let dataDir: string;
  let campaignConsoleService: CampaignConsoleService;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'cosmere-campaign-console-'));
    const database = openSqliteDatabase(path.join(dataDir, 'campaign.sqlite'));

    const simulationService = new SimulationService({
      simulations: new SqliteJsonRepository<SimulationDefinition>(database, 'simulation_definitions'),
      simulationResults: new SqliteJsonRepository<SimulationResult>(database, 'simulation_results'),
      endeavors: new SqliteJsonRepository<Endeavor>(database, 'endeavors'),
      obstacles: new SqliteJsonRepository<Obstacle>(database, 'obstacles'),
      events: new SqliteJsonRepository<EventLogEntry>(database, 'events'),
      diceRolls: new SqliteJsonRepository<DiceRoll>(database, 'dice_rolls'),
      endeavorRuns: new SqliteJsonRepository<EndeavorRun>(database, 'endeavor_runs'),
    });

    campaignConsoleService = new CampaignConsoleService(
      {
        campaigns: new SqliteJsonRepository<Campaign>(database, 'campaigns'),
        chapters: new SqliteJsonRepository<Chapter>(database, 'chapters'),
        chapterStates: new SqliteJsonRepository<ChapterState>(database, 'chapter_states'),
        sessionRuns: new SqliteJsonRepository<SessionRun>(database, 'session_runs'),
        sceneNodes: new SqliteJsonRepository<SceneNode>(database, 'scene_nodes'),
        sceneEdges: new SqliteJsonRepository<SceneEdge>(database, 'scene_edges'),
        sceneStates: new SqliteJsonRepository<SceneState>(database, 'scene_states'),
        hooks: new SqliteJsonRepository<Hook>(database, 'hooks'),
        conditions: new SqliteJsonRepository<Condition>(database, 'conditions'),
        outcomes: new SqliteJsonRepository<Outcome>(database, 'outcomes'),
        endeavors: new SqliteJsonRepository<Endeavor>(database, 'endeavors'),
        obstacles: new SqliteJsonRepository<Obstacle>(database, 'obstacles'),
        encounters: new SqliteJsonRepository<EncounterSetup>(database, 'encounters'),
        npcs: new SqliteJsonRepository<NPC>(database, 'npcs'),
        npcAppearances: new SqliteJsonRepository<NPCAppearance>(database, 'npc_appearances'),
        pcs: new SqliteJsonRepository<PC>(database, 'pcs'),
        pcGoals: new SqliteJsonRepository<PCGoal>(database, 'pc_goals'),
        locations: new SqliteJsonRepository<Location>(database, 'locations'),
        rules: new SqliteJsonRepository<RuleReference>(database, 'rules'),
        resourceDefinitions: new SqliteJsonRepository<ResourceDefinition>(database, 'resource_definitions'),
        statisticDefinitions: new SqliteJsonRepository<StatisticDefinition>(database, 'statistic_definitions'),
        statisticTableDefinitions: new SqliteJsonRepository<StatisticTableDefinition>(database, 'statistic_table_definitions'),
        skillDefinitions: new SqliteJsonRepository<SkillDefinition>(database, 'skill_definitions'),
        actionDefinitions: new SqliteJsonRepository<ActionDefinition>(database, 'action_definitions'),
        resolutionHooks: new SqliteJsonRepository<ResolutionHook>(database, 'resolution_hooks'),
        rewards: new SqliteJsonRepository<Reward>(database, 'rewards'),
        favors: new SqliteJsonRepository<Favor>(database, 'favors'),
        endeavorRuns: new SqliteJsonRepository<EndeavorRun>(database, 'endeavor_runs'),
        simulations: new SqliteJsonRepository<SimulationDefinition>(database, 'simulation_definitions'),
        simulationResults: new SqliteJsonRepository<SimulationResult>(database, 'simulation_results'),
        events: new SqliteJsonRepository<EventLogEntry>(database, 'events'),
        diceRolls: new SqliteJsonRepository<DiceRoll>(database, 'dice_rolls'),
      },
      new RulesEngineService(),
      simulationService,
    );
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it('selects and clears scene outcomes on scene state', async () => {
    const campaignId = 'stonewalkers-campaign';
    const sceneNodeId = 'scene-contact-meeting';
    const outcomeId = 'outcome-contact-trust';

    const selected = await campaignConsoleService.selectSceneOutcome(campaignId, {
      sceneNodeId,
      outcomeId,
      selected: true,
    });

    expect(selected.sceneIndex[sceneNodeId]?.state.chosenOutcomeIds).toContain(outcomeId);

    const cleared = await campaignConsoleService.selectSceneOutcome(campaignId, {
      sceneNodeId,
      outcomeId,
      selected: false,
    });

    expect(cleared.sceneIndex[sceneNodeId]?.state.chosenOutcomeIds).not.toContain(outcomeId);
  });

  it('persists linked stage scene ids on scene state', async () => {
    const campaignId = 'stonewalkers-campaign';
    const sceneNodeId = 'scene-escape-report';

    await campaignConsoleService.linkSceneStage(campaignId, {
      sceneNodeId,
      stageSceneId: 'stage-scene-escape',
    });

    const linked = await campaignConsoleService.getConsole(campaignId);
    expect(linked.sceneIndex[sceneNodeId]?.state.linkedStageSceneId).toBe('stage-scene-escape');

    await campaignConsoleService.linkSceneStage(campaignId, {
      sceneNodeId,
      stageSceneId: null,
    });

    const unlinked = await campaignConsoleService.getConsole(campaignId);
    expect(unlinked.sceneIndex[sceneNodeId]?.state.linkedStageSceneId).toBeUndefined();
  });

  it('creates and cascades deletes authored scene nodes', async () => {
    const campaignId = 'stonewalkers-campaign';
    const initial = await campaignConsoleService.getConsole(campaignId);
    const npcId = initial.npcs[0]?.id;
    expect(npcId).toBeTruthy();

    const created = await campaignConsoleService.upsertSceneNode(campaignId, {
      title: 'Draft signal cache',
      key: 'scene-draft-signal-cache',
      sceneKind: 'investigation',
      board: { x: 4, y: 1, lane: 'drafts' },
      classification: 'optional',
      readiness: 'draft',
      focus: 'Temporary authored node',
      summary: 'A scratch-authored node for testing.',
      gmNote: 'GM note',
      hiddenTruth: 'Hidden truth',
      note: 'Runtime note',
      tags: ['draft'],
      isDefaultStartScene: false,
      isRequiredBeat: false,
      linkedLocationIds: [],
      linkedGoalIds: [],
      npcAppearances: [
        {
          npcId: npcId!,
          aliasInScene: 'Watcher',
          localGoal: 'Observe',
          localSecrets: ['He already knows the signal.'],
          portrayalOverride: [],
          notes: ['Keep him on the edge of the room.'],
        },
      ],
    });

    const createdSceneId = created.board.nodes.find((node) => node.key === 'scene-draft-signal-cache')?.id;
    expect(createdSceneId).toBeTruthy();

    await campaignConsoleService.createSceneEdge(campaignId, {
      fromSceneId: 'scene-contact-meeting',
      toSceneId: createdSceneId!,
      kind: 'path',
      label: 'Draft branch',
    });

    const preview = await campaignConsoleService.previewSceneDelete(campaignId, createdSceneId!);
    expect(preview.connectedEdgeCount).toBe(1);
    expect(preview.sceneStateCount).toBe(1);
    expect(preview.npcAppearanceCount).toBe(1);

    const afterDelete = await campaignConsoleService.deleteSceneNode(campaignId, { sceneNodeId: createdSceneId! });
    expect(afterDelete.sceneIndex[createdSceneId!]).toBeUndefined();
    expect(afterDelete.board.edges.some((edge) => edge.toSceneId === createdSceneId! || edge.fromSceneId === createdSceneId!)).toBe(false);
  });

  it('unlinks deleted shared entities from authored scenes', async () => {
    const campaignId = 'stonewalkers-campaign';

    const locationResult = await campaignConsoleService.upsertLocation(campaignId, {
      name: 'Hidden Balcony',
      key: 'location-hidden-balcony',
      kind: 'site',
      publicSummary: 'A lookout perch above the camp.',
      gmTruth: 'It overlooks the exchange.',
      tags: ['watchpoint'],
    });
    const goalResult = await campaignConsoleService.upsertGoal(campaignId, {
      ownerLabel: 'Kaladin',
      title: 'Find the balcony signal',
      description: 'Track the hidden lookout used by the scouts.',
      progressState: 'active',
      progressNotes: ['Fresh lead.'],
      triggerSceneIds: [],
      triggerNpcIds: [],
    });

    const createdLocationId = locationResult.locations.find((location) => location.key === 'location-hidden-balcony')?.id;
    const createdGoalId = goalResult.pcGoals.find((goal) => goal.title === 'Find the balcony signal')?.id;
    expect(createdLocationId).toBeTruthy();
    expect(createdGoalId).toBeTruthy();

    await campaignConsoleService.upsertSceneNode(campaignId, {
      sceneNodeId: 'scene-contact-meeting',
      title: 'Meet the contact',
      key: 'scene-contact-meeting',
      sceneKind: 'social',
      board: { x: 0, y: 1, lane: 'core' },
      classification: 'critical',
      readiness: 'ready',
      focus: 'Get the PCs aligned with the contact and secure the next step.',
      summary: 'Summary',
      gmNote: 'GM',
      hiddenTruth: 'Truth',
      note: 'Note',
      tags: ['contact'],
      isDefaultStartScene: false,
      isRequiredBeat: true,
      linkedLocationIds: [createdLocationId!],
      linkedGoalIds: [createdGoalId!],
      npcAppearances: [],
    });

    await campaignConsoleService.deleteLocation(campaignId, { locationId: createdLocationId! });
    await campaignConsoleService.deleteGoal(campaignId, { goalId: createdGoalId! });

    const refreshed = await campaignConsoleService.getConsole(campaignId);
    expect(refreshed.sceneIndex['scene-contact-meeting']?.linkedLocationIds).not.toContain(createdLocationId!);
    expect(refreshed.sceneIndex['scene-contact-meeting']?.linkedGoalIds).not.toContain(createdGoalId!);
  });
});
