import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { HttpError } from './lib/http';
import { SessionRepository } from './repositories/session.repository';
import { RollRepository } from './repositories/roll.repository';
import { CombatRepository } from './repositories/combat.repository';
import { StageSceneRepository } from './repositories/stage-scene.repository';
import { LiveStageRepository } from './repositories/live-stage.repository';
import { RollService } from './services/roll.service';
import { SessionService } from './services/session.service';
import { CombatService } from './services/combat.service';
import { StageService } from './services/stage.service';
import { SessionController } from './controllers/session.controller';
import { RollController } from './controllers/roll.controller';
import { CombatController } from './controllers/combat.controller';
import { StageController } from './controllers/stage.controller';
import { createSessionRouter } from './routes/session.routes';
import { createRollRouter } from './routes/roll.routes';
import { createCombatRouter } from './routes/combat.routes';
import { createStageRouter } from './routes/stage.routes';
import { createUploadRouter } from './routes/upload.routes';

const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const uploadsDir = path.join(rootDir, 'uploads');

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(uploadsDir));

const sessionRepository = new SessionRepository(dataDir);
const rollRepository = new RollRepository(dataDir);
const combatRepository = new CombatRepository(dataDir);
const stageSceneRepository = new StageSceneRepository(dataDir);
const liveStageRepository = new LiveStageRepository(dataDir);

const rollService = new RollService(rollRepository);
const sessionService = new SessionService(
  sessionRepository,
  rollRepository,
  combatRepository,
  stageSceneRepository,
  liveStageRepository,
);
const combatService = new CombatService(combatRepository, sessionRepository, rollService);
const stageService = new StageService(stageSceneRepository, liveStageRepository);

app.use('/api/sessions', createSessionRouter(new SessionController(sessionService)));
app.use('/api', createRollRouter(new RollController(rollService)));
app.use('/api', createCombatRouter(new CombatController(combatService)));
app.use('/api', createStageRouter(new StageController(stageService)));
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
