import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { HttpError } from './lib/http';
import { openSqliteDatabase, SqliteJsonRepository } from './lib/sqlite';
import { SessionRepository } from './repositories/session.repository';
import { RollRepository } from './repositories/roll.repository';
import { CombatRepository } from './repositories/combat.repository';
import { StageSceneRepository } from './repositories/stage-scene.repository';
import { LiveStageRepository } from './repositories/live-stage.repository';
import { PartyMemberRepository } from './repositories/party-member.repository';
import { ParticipantTemplateRepository } from './repositories/participant-template.repository';
import { RollService } from './services/roll.service';
import { SessionService } from './services/session.service';
import { CombatService } from './services/combat.service';
import { StageService } from './services/stage.service';
import { CampaignConsoleService } from './services/campaign-console.service';
import { ImportArtifactService } from './services/import-artifact.service';
import { RulesEngineService } from './services/rules-engine.service';
import { SimulationService } from './services/simulation.service';
import { SessionController } from './controllers/session.controller';
import { RollController } from './controllers/roll.controller';
import { CombatController } from './controllers/combat.controller';
import { StageController } from './controllers/stage.controller';
import { BackupController } from './controllers/backup.controller';
import { CampaignConsoleController } from './controllers/campaign-console.controller';
import { ImportArtifactController } from './controllers/import-artifact.controller';
import { createSessionRouter } from './routes/session.routes';
import { createRollRouter } from './routes/roll.routes';
import { createCombatRouter } from './routes/combat.routes';
import { createStageRouter } from './routes/stage.routes';
import { createUploadRouter } from './routes/upload.routes';
import { createBackupRouter } from './routes/backup.routes';
import { createCampaignRouter } from './routes/campaign.routes';
import { createImportRouter } from './routes/import.routes';
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

const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const uploadsDir = path.join(rootDir, 'uploads');

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(uploadsDir));

const sessionRepository = new SessionRepository(dataDir);
const partyMemberRepository = new PartyMemberRepository(dataDir);
const participantTemplateRepository = new ParticipantTemplateRepository(dataDir);
const rollRepository = new RollRepository(dataDir);
const combatRepository = new CombatRepository(dataDir);
const stageSceneRepository = new StageSceneRepository(dataDir);
const liveStageRepository = new LiveStageRepository(dataDir);
const campaignDatabase = openSqliteDatabase(path.join(dataDir, 'cosmere-tracker.sqlite'));

const rollService = new RollService(rollRepository);
const sessionService = new SessionService(
  sessionRepository,
  partyMemberRepository,
  participantTemplateRepository,
  rollRepository,
  combatRepository,
  stageSceneRepository,
  liveStageRepository,
);
const combatService = new CombatService(combatRepository, sessionRepository, rollService);
const stageService = new StageService(sessionRepository, stageSceneRepository, liveStageRepository);
const rulesEngineService = new RulesEngineService();
const simulationService = new SimulationService({
  simulations: new SqliteJsonRepository<SimulationDefinition>(campaignDatabase, 'simulation_definitions'),
  simulationResults: new SqliteJsonRepository<SimulationResult>(campaignDatabase, 'simulation_results'),
  endeavors: new SqliteJsonRepository<Endeavor>(campaignDatabase, 'endeavors'),
  obstacles: new SqliteJsonRepository<Obstacle>(campaignDatabase, 'obstacles'),
  events: new SqliteJsonRepository<EventLogEntry>(campaignDatabase, 'events'),
  diceRolls: new SqliteJsonRepository<DiceRoll>(campaignDatabase, 'dice_rolls'),
  endeavorRuns: new SqliteJsonRepository<EndeavorRun>(campaignDatabase, 'endeavor_runs'),
});
const campaignConsoleRepositories = {
  campaigns: new SqliteJsonRepository<Campaign>(campaignDatabase, 'campaigns'),
  chapters: new SqliteJsonRepository<Chapter>(campaignDatabase, 'chapters'),
  chapterStates: new SqliteJsonRepository<ChapterState>(campaignDatabase, 'chapter_states'),
  sessionRuns: new SqliteJsonRepository<SessionRun>(campaignDatabase, 'session_runs'),
  sceneNodes: new SqliteJsonRepository<SceneNode>(campaignDatabase, 'scene_nodes'),
  sceneEdges: new SqliteJsonRepository<SceneEdge>(campaignDatabase, 'scene_edges'),
  sceneStates: new SqliteJsonRepository<SceneState>(campaignDatabase, 'scene_states'),
  hooks: new SqliteJsonRepository<Hook>(campaignDatabase, 'hooks'),
  conditions: new SqliteJsonRepository<Condition>(campaignDatabase, 'conditions'),
  outcomes: new SqliteJsonRepository<Outcome>(campaignDatabase, 'outcomes'),
  endeavors: new SqliteJsonRepository<Endeavor>(campaignDatabase, 'endeavors'),
  obstacles: new SqliteJsonRepository<Obstacle>(campaignDatabase, 'obstacles'),
  encounters: new SqliteJsonRepository<EncounterSetup>(campaignDatabase, 'encounters'),
  npcs: new SqliteJsonRepository<NPC>(campaignDatabase, 'npcs'),
  npcAppearances: new SqliteJsonRepository<NPCAppearance>(campaignDatabase, 'npc_appearances'),
  pcs: new SqliteJsonRepository<PC>(campaignDatabase, 'pcs'),
  locations: new SqliteJsonRepository<Location>(campaignDatabase, 'locations'),
  rules: new SqliteJsonRepository<RuleReference>(campaignDatabase, 'rules'),
  resourceDefinitions: new SqliteJsonRepository<ResourceDefinition>(campaignDatabase, 'resource_definitions'),
  statisticDefinitions: new SqliteJsonRepository<StatisticDefinition>(campaignDatabase, 'statistic_definitions'),
  statisticTableDefinitions: new SqliteJsonRepository<StatisticTableDefinition>(campaignDatabase, 'statistic_table_definitions'),
  skillDefinitions: new SqliteJsonRepository<SkillDefinition>(campaignDatabase, 'skill_definitions'),
  actionDefinitions: new SqliteJsonRepository<ActionDefinition>(campaignDatabase, 'action_definitions'),
  resolutionHooks: new SqliteJsonRepository<ResolutionHook>(campaignDatabase, 'resolution_hooks'),
  rewards: new SqliteJsonRepository<Reward>(campaignDatabase, 'rewards'),
  favors: new SqliteJsonRepository<Favor>(campaignDatabase, 'favors'),
  endeavorRuns: new SqliteJsonRepository<EndeavorRun>(campaignDatabase, 'endeavor_runs'),
  simulations: new SqliteJsonRepository<SimulationDefinition>(campaignDatabase, 'simulation_definitions'),
  simulationResults: new SqliteJsonRepository<SimulationResult>(campaignDatabase, 'simulation_results'),
  events: new SqliteJsonRepository<EventLogEntry>(campaignDatabase, 'events'),
  diceRolls: new SqliteJsonRepository<DiceRoll>(campaignDatabase, 'dice_rolls'),
};
const campaignConsoleService = new CampaignConsoleService(
  campaignConsoleRepositories,
  rulesEngineService,
  simulationService,
);
const importArtifactService = new ImportArtifactService(campaignDatabase, {
  rules: campaignConsoleRepositories.rules,
  conditions: campaignConsoleRepositories.conditions,
  resourceDefinitions: campaignConsoleRepositories.resourceDefinitions,
  statisticDefinitions: campaignConsoleRepositories.statisticDefinitions,
  statisticTableDefinitions: campaignConsoleRepositories.statisticTableDefinitions,
  skillDefinitions: campaignConsoleRepositories.skillDefinitions,
  actionDefinitions: campaignConsoleRepositories.actionDefinitions,
  resolutionHooks: campaignConsoleRepositories.resolutionHooks,
});

app.use('/api/sessions', createSessionRouter(new SessionController(sessionService)));
app.use('/api', createRollRouter(new RollController(rollService)));
app.use('/api', createCombatRouter(new CombatController(combatService)));
app.use('/api', createStageRouter(new StageController(stageService)));
app.use('/api', createCampaignRouter(new CampaignConsoleController(campaignConsoleService)));
app.use('/api', createImportRouter(new ImportArtifactController(importArtifactService)));
app.use('/api/backup', createBackupRouter(new BackupController(sessionService)));
app.use('/api/uploads', createUploadRouter(uploadsDir));

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({ message: error.message });
    return;
  }

  console.error(error);
  response.status(500).json({ message: 'Internal server error.' });
});

const port = Number(process.env['PORT'] || 3000);
app.listen(port, () => {
  console.log(`Cosmere Tracker backend listening on http://localhost:${port}`);
});
