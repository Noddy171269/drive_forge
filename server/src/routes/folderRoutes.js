import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createFolder,
  updateFolder,
  trashFolder,
} from '../controllers/folderController.js';
import { restoreFolder } from '../controllers/fileController.js';

const router = Router();

router.use(requireAuth);

router.post('/', createFolder);
router.patch('/:id', updateFolder);
router.delete('/:id', trashFolder);
router.post('/:id/restore', restoreFolder);

export default router;
