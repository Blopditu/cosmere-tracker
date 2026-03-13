import { Request, Response } from 'express';
import { StageService } from '../services/stage.service';

export class StageController {
  constructor(private readonly stageService: StageService) {}

  listScenes = async (request: Request, response: Response) => {
    response.json(await this.stageService.listScenes(String(request.params['sessionId'])));
  };

  createScene = async (request: Request, response: Response) => {
    response.status(201).json(await this.stageService.createScene(String(request.params['sessionId']), request.body));
  };

  updateScene = async (request: Request, response: Response) => {
    response.json(await this.stageService.updateScene(String(request.params['sceneId']), request.body));
  };

  deleteScene = async (request: Request, response: Response) => {
    await this.stageService.deleteScene(String(request.params['sceneId']));
    response.status(204).send();
  };

  getLiveState = async (request: Request, response: Response) => {
    response.json(await this.stageService.getLiveState(String(request.params['sessionId'])));
  };

  publishScene = async (request: Request, response: Response) => {
    response.json(
      await this.stageService.publishScene(String(request.params['sessionId']), request.body.liveSceneId ?? null),
    );
  };
}
