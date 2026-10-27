import User from '../models/User.js';
import { signToken } from '../utils/token.js';
import { HttpError } from '../middleware/error.js';

/**
 * POST /api/auth/register  { email, password }
 * 201 { token, user }; 409 if email exists; 400 if password too short.
 */
export async function register(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    throw new HttpError(400, 'Email and password are required');
  }
  if (typeof password !== 'string' || password.length < 6) {
    throw new HttpError(400, 'Password must be at least 6 characters');
  }

  const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (existing) {
    throw new HttpError(409, 'Email already registered');
  }

  const user = new User({ email, password });
  await user.save();

  const token = signToken(user._id);
  res.status(201).json({ token, user: user.toSafeJSON() });
}

/**
 * POST /api/auth/login  { email, password }
 * 200 { token, user }; 401 on bad credentials.
 */
export async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    throw new HttpError(400, 'Email and password are required');
  }

  // passwordHash is select:false, so request it explicitly
  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select(
    '+passwordHash'
  );
  if (!user) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const ok = await user.matchPassword(password);
  if (!ok) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const token = signToken(user._id);
  res.json({ token, user: user.toSafeJSON() });
}

/** GET /api/auth/me -> 200 { user } */
export async function me(req, res) {
  res.json({ user: req.user.toSafeJSON() });
}
