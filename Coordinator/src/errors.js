'use strict';

// Domain errors for the coordination layer, each carrying the HTTP status the
// interaction (route) layer should return to the user.

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

// A downstream service voted to abort / returned a business error (e.g. out of
// stock, insufficient funds). We surface the upstream status so the client sees
// the same 4xx the service produced.
class UpstreamError extends Error {
  constructor(status, body, url) {
    const detail =
      body && typeof body === 'object'
        ? body.message || body.error || JSON.stringify(body)
        : body;
    super(`Upstream ${status} from ${url}: ${detail}`);
    this.name = 'UpstreamError';
    // Pass through 4xx as-is; treat upstream 5xx as a Bad Gateway from our side.
    this.statusCode = status >= 400 && status < 500 ? status : 502;
    this.upstreamStatus = status;
    this.upstreamBody = body;
    this.url = url;
  }
}

// The service could not be reached at all (discovery failed AND fallback URL is
// unreachable, or no fallback configured).
class ServiceUnavailableError extends Error {
  constructor(serviceName, cause) {
    super(`Service '${serviceName}' is unavailable${cause ? `: ${cause.message}` : ''}`);
    this.name = 'ServiceUnavailableError';
    this.statusCode = 503;
    this.serviceName = serviceName;
  }
}

// Two-phase-commit aborted during the prepare (voting) phase — no participant
// was committed, everything already prepared has been rolled back.
class TransactionAbortedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TransactionAbortedError';
    this.statusCode = 409;
  }
}

module.exports = {
  ValidationError,
  UpstreamError,
  ServiceUnavailableError,
  TransactionAbortedError,
};
