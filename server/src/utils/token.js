import jwt from 'jsonwebtoken';

/**
 * Sign a JWT for a user id. Secret and expiry come from the environment so they
 * are never hard-coded.
 */
export function signToken(userId) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  return jwt.sign({ sub: String(userId) }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

/**
 * Verify a JWT and return its decoded payload. Throws on invalid/expired tokens.
 */
export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}
