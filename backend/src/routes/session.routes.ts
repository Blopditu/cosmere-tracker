import { Router } from 'express';
import { asyncHandler } from '../lib/http';
import { SessionController } from '../controllers/session.controller';

export function createSessionRouter(controller: SessionController): Router {
  const router = Router();
  router.get('/', asyncHandler(controller.list));
  router.post('/', asyncHandler(controller.create));
  router.get('/:sessionId', asyncHandler(controller.get));
  router.patch('/:sessionId', asyncHandler(controller.update));
  router.delete('/:sessionId', asyncHandler(controller.delete));
  router.get('/:sessionId/dashboard', asyncHandler(controller.dashboard));
  router.get('/:sessionId/analytics', asyncHandler(controller.analytics));
  router.get('/:sessionId/export', asyncHandler(controller.exportSession));
  router.post('/import', asyncHandler(controller.importSession));
  return router;
}
