/**
 * Error thrown when connection to an exchange fails.
 */
export class ExchangeConnectionError extends Error {
  constructor(exchange: string, message: string) {
    super(`Failed to connect to ${exchange}: ${message}`);
    this.name = 'ExchangeConnectionError';
  }
}

/**
 * Error thrown when a symbol is not found on an exchange.
 */
export class SymbolNotFoundError extends Error {
  constructor(symbol: string, exchange: string) {
    super(`Symbol ${symbol} not found on ${exchange}`);
    this.name = 'SymbolNotFoundError';
  }
}

/**
 * Error thrown when subscription to a symbol fails.
 */
export class SubscriptionError extends Error {
  constructor(symbol: string, message: string) {
    super(`Failed to subscribe to ${symbol}: ${message}`);
    this.name = 'SubscriptionError';
  }
}

/**
 * Error thrown when an exchange operation times out.
 */
export class ExchangeTimeoutError extends Error {
  constructor(exchange: string, operation: string, timeout: number) {
    super(`Exchange ${exchange} operation ${operation} timed out after ${timeout}ms`);
    this.name = 'ExchangeTimeoutError';
  }
}