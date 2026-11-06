/** Error raised by the graph layer. `code` is machine-readable. */
export class GraphError extends Error {
  /** @param {string} code @param {string} message @param {object} [details] */
  constructor(code, message, details) {
    super(message);
    this.name = 'GraphError';
    this.code = code;
    this.details = details;
  }
}

/** Error raised by routing algorithms / request validation. */
export class RouteError extends Error {
  /** @param {string} code @param {string} message @param {object} [details] */
  constructor(code, message, details) {
    super(message);
    this.name = 'RouteError';
    this.code = code;
    this.details = details;
  }
}
