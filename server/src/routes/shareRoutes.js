import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createShare,
  resolvePublic,
  sharedWithMe,
  revokeShare,
  myShares,
} from '../controllers/shareController.js';

const router = Router();

// Public resolve is unauthenticated. Must be declared carefully relative to the
// other GETs below; Express matches in order, so the specific string routes
// (/shared-with-me, /mine) are registered before the /:token wildcard.
router.get('/shared-with-me', requireAuth, sharedWithMe);
router.get('/mine', requireAuth, myShares);
router.get('/:token', resolvePublic);

router.post('/', requireAuth, createShare);
router.post('/:id/revoke', requireAuth, revokeShare);

export default router;
