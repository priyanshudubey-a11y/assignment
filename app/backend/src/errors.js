'use strict';

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const MESSAGES = {
  UNAUTHENTICATED: 'Sign in to continue.',
  QUOTE_NOT_FOUND: 'Quote not found.',
  INTERNAL: 'Something went wrong. Try again.',
  INVALID_CREDENTIALS: 'Incorrect email or password.',
  LIST_INVALID: 'Could not load quotes. Try again.',
};

const unauthenticated = () => new ApiError(401, 'UNAUTHENTICATED', MESSAGES.UNAUTHENTICATED);
const quoteNotFound = () => new ApiError(404, 'NOT_FOUND', MESSAGES.QUOTE_NOT_FOUND);
const validation = (message, details) => new ApiError(400, 'VALIDATION_ERROR', message, details);

module.exports = { ApiError, MESSAGES, unauthenticated, quoteNotFound, validation };
