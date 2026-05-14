export class RbacError extends Error {
  readonly code = 'RBAC_FORBIDDEN';
  constructor(action: string) {
    super(`Forbidden: ${action}`);
    this.name = 'RbacError';
  }
}

export class ValidationError extends Error {
  readonly code = 'VALIDATION_FAILED';
  constructor(
    message: string,
    public readonly issues?: unknown,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND';
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}
