import { Request, Response } from 'express';
import { ImportArtifactService } from '../services/import-artifact.service';

export class ImportArtifactController {
  constructor(private readonly importArtifactService: ImportArtifactService) {}

  registerLocalArtifact = async (request: Request, response: Response) => {
    response.status(201).json(await this.importArtifactService.registerLocalArtifact(request.body));
  };

  listReviewDocuments = async (_request: Request, response: Response) => {
    response.json(await this.importArtifactService.listReviewDocuments());
  };

  getReviewDocument = async (request: Request, response: Response) => {
    response.json(await this.importArtifactService.getReviewDocument(String(request.params['documentId'])));
  };

  getCandidateDetail = async (request: Request, response: Response) => {
    response.json(await this.importArtifactService.getCandidateDetail(String(request.params['candidateId'])));
  };

  decideCandidate = async (request: Request, response: Response) => {
    response.json(
      await this.importArtifactService.decideCandidate(String(request.params['candidateId']), request.body),
    );
  };

  publishDocument = async (request: Request, response: Response) => {
    response.json(await this.importArtifactService.publishDocument(String(request.params['documentId'])));
  };
}
