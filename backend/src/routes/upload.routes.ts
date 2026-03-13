import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { promises as fs } from 'node:fs';

export function createUploadRouter(uploadsDir: string): Router {
  const storage = multer.diskStorage({
    destination: async (request, _file, callback) => {
      const sessionId = String(request.body.sessionId || 'shared');
      const targetDir = path.join(uploadsDir, 'stage-backgrounds', sessionId);
      await fs.mkdir(targetDir, { recursive: true });
      callback(null, targetDir);
    },
    filename: (_request, file, callback) => {
      const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '-')}`;
      callback(null, safeName);
    },
  });
  const upload = multer({ storage });
  const router = Router();

  router.post('/stage-background', upload.single('image'), (request, response) => {
    const sessionId = String(request.body.sessionId || 'shared');
    const file = request.file;
    if (!file) {
      response.status(400).json({ message: 'Image upload failed.' });
      return;
    }
    response.status(201).json({
      backgroundImagePath: `/uploads/stage-backgrounds/${sessionId}/${file.filename}`,
    });
  });

  return router;
}
