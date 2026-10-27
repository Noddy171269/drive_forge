/**
 * A small helper to throw errors with an attached HTTP status code.
 * Usage: throw new HttpError(404, 'Not found')
 */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** 404 handler for unmatched routes. */
export function notFound(req, res) {
  res.status(404).json({ message: `Not found: ${req.method} ${req.originalUrl}` });
}

/**
 * Centralized error middleware. Formats every error as { message } with the
 * correct status code and never leaks stack traces in production.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Internal server error';

  // Mongoose validation -> 400
  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join('; ');
  }

  // Bad ObjectId in a param -> 400
  if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}`;
  }

  // Duplicate key (e.g. unique email) -> 409
  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    message = `${field} already exists`;
  }

  // Multer file-size limit -> 413
  if (err.code === 'LIMIT_FILE_SIZE') {
    status = 413;
    message = 'File exceeds the maximum allowed size';
  }

  if (status >= 500) {
    console.error('[error]', err);
  }

  const body = { message };
  if (process.env.NODE_ENV !== 'production' && status >= 500) {
    body.stack = err.stack;
  }

  res.status(status).json(body);
}
