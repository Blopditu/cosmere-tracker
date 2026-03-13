import { Request, Response } from 'express';
import { SessionService } from '../services/session.service';

export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  list = async (_request: Request, response: Response) => {
    response.json(await this.sessionService.list());
  };

  get = async (request: Request, response: Response) => {
    response.json(await this.sessionService.get(String(request.params['sessionId'])));
  };

  create = async (request: Request, response: Response) => {
    response.status(201).json(await this.sessionService.create(request.body));
  };

  update = async (request: Request, response: Response) => {
    response.json(await this.sessionService.update(String(request.params['sessionId']), request.body));
  };

  delete = async (request: Request, response: Response) => {
    await this.sessionService.delete(String(request.params['sessionId']));
    response.status(204).send();
  };

  dashboard = async (request: Request, response: Response) => {
    response.json(await this.sessionService.dashboard(String(request.params['sessionId'])));
  };
}
