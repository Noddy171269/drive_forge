import { verifyToken } from '../utils/token.js';
import User from '../models/User.js';

async function authenticate(token, res, next) {
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  const user = await User.findById(payload.sub);
  if (!user) {
    return res.status(401).json({ message: 'User no longer exists' });
  }
  return { user, next };
}

/**
 * Require a valid Bearer JWT. Loads the user and attaches it to req.user.
 * Responds 401 on any missing/invalid/expired token.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  const result = await authenticate(token, res, next);
  if (!result) return; // response already sent
  req.user = result.user;
  next();
}

/**
 * Optional auth for the media download route. Accepts the JWT via the
 * Authorization header OR a `?token=` query param (so a browser <video>/<img>
 * element, which cannot set headers, can still stream with HTTP Range). If a
 * valid token is present it attaches req.user; if absent or invalid it simply
 * continues WITHOUT a user, so the controller can still authorize anonymous
 * access via a public share token. Never responds 401 itself.
 *
 * This header-or-query tradeoff is deliberate; production would issue
 * short-lived signed URLs instead (see README "Future Work").
 */
export async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, headerToken] = header.split(' ');
  const token = scheme === 'Bearer' && headerToken ? headerToken : req.query.token;

  if (!token) return next();

  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);
    if (user) req.user = user;
  } catch {
    // ignore invalid token; controller will enforce access
  }
  next();
}
