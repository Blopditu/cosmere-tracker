import { Router } from 'express';
import { asyncHandler } from '../lib/http';
import { CampaignConsoleController } from '../controllers/campaign-console.controller';

export function createCampaignRouter(controller: CampaignConsoleController): Router {
  const router = Router();

  router.get('/campaigns', asyncHandler(controller.listCampaigns));
  router.get('/campaigns/:campaignId/console', asyncHandler(controller.getConsole));
  router.patch('/campaigns/:campaignId/scenes/state', asyncHandler(controller.updateSceneState));
  router.post('/campaigns/:campaignId/runtime/notes', asyncHandler(controller.addQuickNote));
  router.post('/campaigns/:campaignId/scenes/outcomes', asyncHandler(controller.selectSceneOutcome));
  router.patch('/campaigns/:campaignId/scenes/stage-link', asyncHandler(controller.linkSceneStage));
  router.get('/campaigns/:campaignId/scenes/:sceneNodeId/delete-preview', asyncHandler(controller.previewSceneDelete));
  router.post('/campaigns/:campaignId/scenes', asyncHandler(controller.upsertSceneNode));
  router.delete('/campaigns/:campaignId/scenes', asyncHandler(controller.deleteSceneNode));
  router.post('/campaigns/:campaignId/scene-edges', asyncHandler(controller.createSceneEdge));
  router.delete('/campaigns/:campaignId/scene-edges', asyncHandler(controller.deleteSceneEdge));
  router.post('/campaigns/:campaignId/npcs', asyncHandler(controller.upsertNpc));
  router.delete('/campaigns/:campaignId/npcs', asyncHandler(controller.deleteNpc));
  router.post('/campaigns/:campaignId/locations', asyncHandler(controller.upsertLocation));
  router.delete('/campaigns/:campaignId/locations', asyncHandler(controller.deleteLocation));
  router.post('/campaigns/:campaignId/goals', asyncHandler(controller.upsertGoal));
  router.delete('/campaigns/:campaignId/goals', asyncHandler(controller.deleteGoal));
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
