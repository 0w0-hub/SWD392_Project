'use strict';

// Domain errors carrying the HTTP status the route layer should return.

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

// Used for "out of stock" (reserve) and "not enough reserved" (commit) —
// i.e. the participant votes to abort the two-phase commit.
class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

module.exports = { NotFoundError, ConflictError, ValidationError };
