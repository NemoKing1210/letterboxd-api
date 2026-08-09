export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;
  override readonly cause?: unknown;

  constructor(params: {
    message: string;
    code: string;
    status?: number;
    details?: unknown;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = 'AppError';
    this.code = params.code;
    this.status = params.status ?? 500;
    this.details = params.details;
    this.cause = params.cause;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super({ message, code: 'NOT_FOUND', status: 404, details });
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super({ message, code: 'VALIDATION_ERROR', status: 400, details });
    this.name = 'ValidationError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: unknown) {
    super({ message, code: 'CONFLICT', status: 409, details });
    this.name = 'ConflictError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(message = 'External service error', details?: unknown, cause?: unknown) {
    super({ message, code: 'EXTERNAL_SERVICE_ERROR', status: 502, details, cause });
    this.name = 'ExternalServiceError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super({ message, code: 'RATE_LIMIT_EXCEEDED', status: 429 });
    this.name = 'RateLimitError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super({ message, code: 'UNAUTHORIZED', status: 401 });
    this.name = 'UnauthorizedError';
  }
}
