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

  campaignRoster = async (_request: Request, response: Response) => {
    response.json(await this.sessionService.campaignRoster());
  };

  updateCampaignRoster = async (request: Request, response: Response) => {
    response.json(await this.sessionService.updateCampaignRoster(request.body));
  };

  analytics = async (request: Request, response: Response) => {
    response.json(await this.sessionService.analytics(String(request.params['sessionId'])));
  };

  exportSession = async (request: Request, response: Response) => {
    response.json(await this.sessionService.exportSession(String(request.params['sessionId'])));
  };

  importSession = async (request: Request, response: Response) => {
    response.status(201).json(await this.sessionService.importSession(request.body));
  };

  exportFullApp = async (_request: Request, response: Response) => {
    response.json(await this.sessionService.exportFullApp());
  };

  importFullApp = async (request: Request, response: Response) => {
    response.json(await this.sessionService.importFullApp(request.body));
  };
}
