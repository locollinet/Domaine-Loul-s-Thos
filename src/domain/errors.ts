/** Typed business error. A refused command never mutates state. */
export type DomainErrorCode =
  | 'not_found'
  | 'invalid_quantity'
  | 'insufficient_volume'
  | 'insufficient_stock'
  | 'capacity_exceeded'
  | 'quality_hold'
  | 'invalid_state'
  | 'conservation'
  | 'forbidden_role'
  | 'conflict'
  | 'idempotency_conflict'
  | 'validation';

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly field: string | undefined;

  constructor(code: DomainErrorCode, message: string, field?: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.field = field;
  }
}

export function ensure(condition: unknown, code: DomainErrorCode, message: string, field?: string): asserts condition {
  if (!condition) throw new DomainError(code, message, field);
}

export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError || (typeof e === 'object' && e !== null && (e as { name?: string }).name === 'DomainError');
}
