import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import {
  listFolder,
  uploadFile,
  downloadFile,
  updateFile,
  trashFile,
  restoreFile,
  listTrash,
  permanentDelete,
} from '../controllers/fileController.js';

const router = Router();

// Download authorizes via owner JWT, user-share, OR a public share token, and
// accepts the JWT via header or ?token= so media elements can stream.
router.get('/:id/download', optionalAuth, downloadFile);

// Everything else requires a strict Bearer header.
router.get('/', requireAuth, listFolder);
router.post('/upload', requireAuth, upload.single('file'), uploadFile);
router.patch('/:id', requireAuth, updateFile);
router.delete('/:id', requireAuth, trashFile);
router.post('/:id/restore', requireAuth, restoreFile);

export default router;

// Separate router mounted at /api/trash
const trashRouter = Router();
trashRouter.use(requireAuth);
trashRouter.get('/', listTrash);
trashRouter.delete('/:id', permanentDelete);

export { trashRouter };
