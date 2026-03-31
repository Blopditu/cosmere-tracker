import { Router } from 'express';
import { asyncHandler } from '../lib/http';
import { ImportArtifactController } from '../controllers/import-artifact.controller';

export function createImportRouter(controller: ImportArtifactController): Router {
  const router = Router();

  router.post('/import/artifacts/register-local', asyncHandler(controller.registerLocalArtifact));
  router.get('/import/review', asyncHandler(controller.listReviewDocuments));
  router.get('/import/review/documents/:documentId', asyncHandler(controller.getReviewDocument));
  router.get('/import/review/candidates/:candidateId', asyncHandler(controller.getCandidateDetail));
  router.post('/import/review/candidates/:candidateId/decision', asyncHandler(controller.decideCandidate));
  router.post('/import/review/documents/:documentId/publish', asyncHandler(controller.publishDocument));

  return router;
}
