import { Request, Response } from 'express';
import { CampaignConsoleService } from '../services/campaign-console.service';

export class CampaignConsoleController {
  constructor(private readonly campaignConsoleService: CampaignConsoleService) {}

  listCampaigns = async (_request: Request, response: Response) => {
    response.json(await this.campaignConsoleService.listCampaigns());
  };

  getConsole = async (request: Request, response: Response) => {
    response.json(await this.campaignConsoleService.getConsole(String(request.params['campaignId'])));
  };

  updateSceneState = async (request: Request, response: Response) => {
    response.json(
      await this.campaignConsoleService.updateSceneState(String(request.params['campaignId']), request.body),
    );
  };

  addQuickNote = async (request: Request, response: Response) => {
    response.json(await this.campaignConsoleService.addQuickNote(String(request.params['campaignId']), request.body));
  };

  adjustFavor = async (request: Request, response: Response) => {
    response.json(await this.campaignConsoleService.adjustFavor(String(request.params['campaignId']), request.body));
  };

  adjustResource = async (request: Request, response: Response) => {
    response.json(await this.campaignConsoleService.adjustResource(String(request.params['campaignId']), request.body));
  };

  mutateCondition = async (request: Request, response: Response) => {
    response.json(await this.campaignConsoleService.mutateCondition(String(request.params['campaignId']), request.body));
  };

  logDiceRoll = async (request: Request, response: Response) => {
    response.json(await this.campaignConsoleService.logDiceRoll(String(request.params['campaignId']), request.body));
  };
}
