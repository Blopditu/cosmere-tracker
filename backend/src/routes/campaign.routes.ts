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

  return router;
}
