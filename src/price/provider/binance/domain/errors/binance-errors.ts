export class BinanceConnectionError extends Error {
  constructor(message: string) {
    super(`Failed to connect to Binance: ${message}`);
    this.name = 'BinanceConnectionError';
  }
}

export class BinanceSymbolNotFoundError extends Error {
  constructor(symbol: string) {
    super(`Symbol ${symbol} not found on Binance`);
    this.name = 'BinanceSymbolNotFoundError';
  }
}

export class BinanceSubscriptionError extends Error {
  constructor(symbol: string, message: string) {
    super(`Failed to subscribe to ${symbol}: ${message}`);
    this.name = 'BinanceSubscriptionError';
  }
}

export class BinanceTimeoutError extends Error {
  constructor(operation: string, timeout: number) {
    super(`Binance operation ${operation} timed out after ${timeout}ms`);
    this.name = 'BinanceTimeoutError';
  }
}