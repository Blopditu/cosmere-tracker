import { Router } from 'express';
import { asyncHandler } from '../lib/http';
import { BackupController } from '../controllers/backup.controller';

export function createBackupRouter(controller: BackupController): Router {
  const router = Router();
  router.get('/export', asyncHandler(controller.export));
  router.post('/import', asyncHandler(controller.import));
  return router;
}
