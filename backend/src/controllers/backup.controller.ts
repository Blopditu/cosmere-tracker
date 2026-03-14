import { Request, Response } from 'express';
import { SessionService } from '../services/session.service';

export class BackupController {
  constructor(private readonly sessionService: SessionService) {}

  export = async (_request: Request, response: Response) => {
    response.json(await this.sessionService.exportFullApp());
  };

  import = async (request: Request, response: Response) => {
    response.json(await this.sessionService.importFullApp(request.body));
  };
}
