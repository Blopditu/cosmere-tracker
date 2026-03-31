import { Router } from 'express';
import { asyncHandler } from '../lib/http';
import { CampaignConsoleController } from '../controllers/campaign-console.controller';

export function createCampaignRouter(controller: CampaignConsoleController): Router {
  const router = Router();

  router.get('/campaigns', asyncHandler(controller.listCampaigns));
  router.get('/campaigns/:campaignId/console', asyncHandler(controller.getConsole));
  router.patch('/campaigns/:campaignId/scenes/state', asyncHandler(controller.updateSceneState));
  router.post('/campaigns/:campaignId/runtime/notes', asyncHandler(controller.addQuickNote));
  router.post('/campaigns/:campaignId/runtime/favors', asyncHandler(controller.adjustFavor));
  router.post('/campaigns/:campaignId/runtime/resources', asyncHandler(controller.adjustResource));
  router.post('/campaigns/:campaignId/runtime/conditions', asyncHandler(controller.mutateCondition));
  router.post('/campaigns/:campaignId/runtime/dice-rolls', asyncHandler(controller.logDiceRoll));
  router.post('/rules/evaluate', asyncHandler(controller.evaluateRules));
  router.post('/campaigns/:campaignId/endeavors/:endeavorId/start', asyncHandler(controller.startEndeavorRun));
  router.post('/campaigns/:campaignId/endeavor-runs/:runId/resolve', asyncHandler(controller.resolveEndeavorApproach));
  router.post('/campaigns/:campaignId/endeavor-runs/:runId/adjust', asyncHandler(controller.adjustEndeavorRun));
  router.post('/simulations', asyncHandler(controller.createSimulation));
  router.post('/simulations/:simulationDefinitionId/run', asyncHandler(controller.runSimulation));
  router.get('/simulations/:simulationDefinitionId/results', asyncHandler(controller.listSimulationResults));
  router.get('/analytics/campaigns/:campaignId', asyncHandler(controller.getAnalytics));

  return router;
}
