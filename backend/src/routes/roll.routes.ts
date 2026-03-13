import { Router } from 'express';
import { asyncHandler } from '../lib/http';
import { RollController } from '../controllers/roll.controller';

export function createRollRouter(controller: RollController): Router {
  const router = Router();
  router.get('/sessions/:sessionId/rolls', asyncHandler(controller.list));
  router.post('/sessions/:sessionId/rolls', asyncHandler(controller.create));
  router.get('/sessions/:sessionId/rolls/analytics', asyncHandler(controller.analytics));
  router.patch('/rolls/:rollId', asyncHandler(controller.update));
  return router;
}
