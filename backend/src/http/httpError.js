/**
 * Error with an HTTP status and a stable machine-readable code.
 * Controllers translate it to `{ error: { code, message, details? } }`.
 */
export class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} code
   * @param {string} message
   * @param {object} [details]
   */
  constructor(status, code, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function sendError(res, status, code, message, details) {
  return res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
}

/** Wrap an async Express handler so rejections reach the error middleware (Express 4 does not do this itself). */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    if (err instanceof HttpError) return sendError(res, err.status, err.code, err.message, err.details);
    return next(err);
  });
};
