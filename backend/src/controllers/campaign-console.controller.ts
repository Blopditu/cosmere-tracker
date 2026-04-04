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

  selectSceneOutcome = async (request: Request, response: Response) => {
    response.json(
      await this.campaignConsoleService.selectSceneOutcome(String(request.params['campaignId']), request.body),
    );
  };

  linkSceneStage = async (request: Request, response: Response) => {
    response.json(await this.campaignConsoleService.linkSceneStage(String(request.params['campaignId']), request.body));
  };

  previewSceneDelete = async (request: Request, response: Response) => {
    response.json(
      await this.campaignConsoleService.previewSceneDelete(
        String(request.params['campaignId']),
        String(request.params['sceneNodeId']),
      ),
    );
  };

  upsertSceneNode = async (request: Request, response: Response) => {
    response.json(await this.campaignConsoleService.upsertSceneNode(String(request.params['campaignId']), request.body));
  };

  deleteSceneNode = async (request: Request, response: Response) => {
    response.json(await this.campaignConsoleService.deleteSceneNode(String(request.params['campaignId']), request.body));
  };

  createSceneEdge = async (request: Request, response: Response) => {
    response.json(await this.campaignConsoleService.createSceneEdge(String(request.params['campaignId']), request.body));
  };

  deleteSceneEdge = async (request: Request, response: Response) => {
    response.json(await this.campaignConsoleService.deleteSceneEdge(String(request.params['campaignId']), request.body));
  };

  upsertNpc = async (request: Request, response: Response) => {
    response.json(await this.campaignConsoleService.upsertNpc(String(request.params['campaignId']), request.body));
  };

  deleteNpc = async (request: Request, response: Response) => {
    response.json(await this.campaignConsoleService.deleteNpc(String(request.params['campaignId']), request.body));
  };

  upsertLocation = async (request: Request, response: Response) => {
    response.json(await this.campaignConsoleService.upsertLocation(String(request.params['campaignId']), request.body));
  };

  deleteLocation = async (request: Request, response: Response) => {
    response.json(await this.campaignConsoleService.deleteLocation(String(request.params['campaignId']), request.body));
  };

  upsertGoal = async (request: Request, response: Response) => {
    response.json(await this.campaignConsoleService.upsertGoal(String(request.params['campaignId']), request.body));
  };

  deleteGoal = async (request: Request, response: Response) => {
    response.json(await this.campaignConsoleService.deleteGoal(String(request.params['campaignId']), request.body));
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

  evaluateRules = async (request: Request, response: Response) => {
    response.json(await this.campaignConsoleService.evaluateRules(request.body));
  };

  startEndeavorRun = async (request: Request, response: Response) => {
    response.json(
      await this.campaignConsoleService.startEndeavorRun(
        String(request.params['campaignId']),
        String(request.params['endeavorId']),
      ),
    );
  };

  resolveEndeavorApproach = async (request: Request, response: Response) => {
    response.json(
      await this.campaignConsoleService.resolveEndeavorApproach(
        String(request.params['campaignId']),
        String(request.params['runId']),
        request.body,
      ),
    );
  };

  adjustEndeavorRun = async (request: Request, response: Response) => {
    response.json(
      await this.campaignConsoleService.adjustEndeavorRun(
        String(request.params['campaignId']),
        String(request.params['runId']),
        request.body,
      ),
    );
  };

  createSimulation = async (request: Request, response: Response) => {
    response.status(201).json(await this.campaignConsoleService.createSimulation(request.body));
  };

  runSimulation = async (request: Request, response: Response) => {
    response.json(await this.campaignConsoleService.runSimulation(String(request.params['simulationDefinitionId'])));
  };

  listSimulationResults = async (request: Request, response: Response) => {
    response.json(await this.campaignConsoleService.listSimulationResults(String(request.params['simulationDefinitionId'])));
  };

  getAnalytics = async (request: Request, response: Response) => {
    response.json(await this.campaignConsoleService.getAnalytics(String(request.params['campaignId'])));
  };
}
