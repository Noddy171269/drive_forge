import User from '../models/User.js';

/** GET /api/storage -> { used, quota, percent } for the caller. */
export async function getStorage(req, res) {
  const user = await User.findById(req.user._id).select('storageUsed storageQuota');
  const used = user.storageUsed;
  const quota = user.storageQuota;
  const percent = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  res.json({ used, quota, percent });
}
