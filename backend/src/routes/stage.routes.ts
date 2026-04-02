import { Router } from 'express';
import { asyncHandler } from '../lib/http';
import { StageController } from '../controllers/stage.controller';

export function createStageRouter(controller: StageController): Router {
  const router = Router();
  router.get('/sessions/:sessionId/stage-scenes', asyncHandler(controller.listScenes));
  router.post('/sessions/:sessionId/stage-scenes/import', asyncHandler(controller.importScenes));
  router.post('/sessions/:sessionId/stage-scenes', asyncHandler(controller.createScene));
  router.patch('/stage-scenes/:sceneId', asyncHandler(controller.updateScene));
  router.delete('/stage-scenes/:sceneId', asyncHandler(controller.deleteScene));
  router.get('/sessions/:sessionId/live-stage', asyncHandler(controller.getLiveState));
  router.put('/sessions/:sessionId/live-stage', asyncHandler(controller.publishScene));
  return router;
}
