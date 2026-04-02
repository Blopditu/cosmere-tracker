import { Request, Response } from 'express';
import { CombatService } from '../services/combat.service';

export class CombatController {
  constructor(private readonly combatService: CombatService) {}

  list = async (request: Request, response: Response) => {
    response.json(await this.combatService.listBySession(String(request.params['sessionId'])));
  };

  get = async (request: Request, response: Response) => {
    response.json(await this.combatService.get(String(request.params['combatId'])));
  };

  create = async (request: Request, response: Response) => {
    response.status(201).json(await this.combatService.create(String(request.params['sessionId']), request.body));
  };

  update = async (request: Request, response: Response) => {
    response.json(await this.combatService.update(String(request.params['combatId']), request.body));
  };

  start = async (request: Request, response: Response) => {
    response.json(await this.combatService.start(String(request.params['combatId'])));
  };

  finish = async (request: Request, response: Response) => {
    response.json(await this.combatService.finish(String(request.params['combatId'])));
  };

  commitCurrentRound = async (request: Request, response: Response) => {
    response.status(201).json(await this.combatService.commitCurrentRound(String(request.params['combatId']), request.body));
  };

  advanceCurrentPhase = async (request: Request, response: Response) => {
    response.json(await this.combatService.advanceCurrentPhase(String(request.params['combatId'])));
  };

  reorderCurrentRound = async (request: Request, response: Response) => {
    response.json(await this.combatService.reorderCurrentRound(String(request.params['combatId']), request.body));
  };

  completeTurn = async (request: Request, response: Response) => {
    response.json(await this.combatService.completeTurn(String(request.params['combatId']), String(request.params['turnId'])));
  };

  spendReaction = async (request: Request, response: Response) => {
    response.json(
      await this.combatService.spendReaction(
        String(request.params['combatId']),
        String(request.params['participantId']),
      ),
    );
  };

  updateStrikePreset = async (request: Request, response: Response) => {
    response.json(
      await this.combatService.updateStrikePreset(
        String(request.params['combatId']),
        String(request.params['participantId']),
        request.body,
      ),
    );
  };

  logAction = async (request: Request, response: Response) => {
    response.status(201).json(await this.combatService.logAction(String(request.params['combatId']), request.body));
  };

  revertAction = async (request: Request, response: Response) => {
    response.json(
      await this.combatService.revertAction(
        String(request.params['combatId']),
        String(request.params['actionEventId']),
      ),
    );
  };

  logDamage = async (request: Request, response: Response) => {
    response.status(201).json(await this.combatService.logDamage(String(request.params['combatId']), request.body));
  };

  logFocus = async (request: Request, response: Response) => {
    response.status(201).json(await this.combatService.logFocus(String(request.params['combatId']), request.body));
  };

  logInvestiture = async (request: Request, response: Response) => {
    response.status(201).json(await this.combatService.logInvestiture(String(request.params['combatId']), request.body));
  };

  logHealth = async (request: Request, response: Response) => {
    response.status(201).json(await this.combatService.logHealth(String(request.params['combatId']), request.body));
  };

  logCondition = async (request: Request, response: Response) => {
    response.status(201).json(await this.combatService.logCondition(String(request.params['combatId']), request.body));
  };

  summary = async (request: Request, response: Response) => {
    response.json(await this.combatService.summary(String(request.params['combatId'])));
  };
}
