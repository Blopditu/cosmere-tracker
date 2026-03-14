import { Router } from 'express';
import { asyncHandler } from '../lib/http';
import { CombatController } from '../controllers/combat.controller';

export function createCombatRouter(controller: CombatController): Router {
  const router = Router();
  router.get('/sessions/:sessionId/combats', asyncHandler(controller.list));
  router.post('/sessions/:sessionId/combats', asyncHandler(controller.create));
  router.get('/combats/:combatId', asyncHandler(controller.get));
  router.patch('/combats/:combatId', asyncHandler(controller.update));
  router.post('/combats/:combatId/start', asyncHandler(controller.start));
  router.post('/combats/:combatId/finish', asyncHandler(controller.finish));
  router.post('/combats/:combatId/rounds', asyncHandler(controller.createRound));
  router.patch('/combats/:combatId/rounds/:roundId', asyncHandler(controller.updateRound));
  router.patch('/combats/:combatId/turns/:turnId', asyncHandler(controller.updateTurn));
  router.post('/combats/:combatId/actions', asyncHandler(controller.logAction));
  router.delete('/combats/:combatId/actions/:actionEventId', asyncHandler(controller.revertAction));
  router.post('/combats/:combatId/damage-events', asyncHandler(controller.logDamage));
  router.post('/combats/:combatId/focus-events', asyncHandler(controller.logFocus));
  router.post('/combats/:combatId/health-events', asyncHandler(controller.logHealth));
  router.post('/combats/:combatId/condition-events', asyncHandler(controller.logCondition));
  router.get('/combats/:combatId/summary', asyncHandler(controller.summary));
  return router;
}
