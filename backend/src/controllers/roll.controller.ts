import { Request, Response } from 'express';
import { RollService } from '../services/roll.service';

export class RollController {
  constructor(private readonly rollService: RollService) {}

  list = async (request: Request, response: Response) => {
    response.json(await this.rollService.listBySession(String(request.params['sessionId'])));
  };

  create = async (request: Request, response: Response) => {
    response.status(201).json(await this.rollService.create(String(request.params['sessionId']), request.body));
  };

  analytics = async (request: Request, response: Response) => {
    response.json(await this.rollService.analytics(String(request.params['sessionId'])));
  };

  update = async (request: Request, response: Response) => {
    const roll = await this.rollService.update(String(request.params['rollId']), request.body);
    response.json(roll);
  };
}
