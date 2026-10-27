import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getStorage } from '../controllers/storageController.js';

const router = Router();

router.use(requireAuth);
router.get('/', getStorage);

export default router;
