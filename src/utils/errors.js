class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

class NotFoundError extends ApiError {
  constructor(message = 'Resource not found') {
    super(404, message);
  }
}

class ValidationError extends ApiError {
  constructor(message = 'Validation failed', details) {
    super(400, message, details);
  }
}

class ConflictError extends ApiError {
  constructor(message = 'Conflict', details) {
    super(409, message, details);
  }
}

module.exports = { ApiError, NotFoundError, ValidationError, ConflictError };
