/**
 * Error thrown when an invalid state transition is attempted.
 */
export class InvalidTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid transition from ${from} to ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

/**
 * Error thrown when a trade is not found in the repository.
 */
export class TradeNotFoundError extends Error {
  constructor(id: string) {
    super(`Trade not found: ${id}`);
    this.name = 'TradeNotFoundError';
  }
}