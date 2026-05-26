/**
 * Ticker data from an exchange.
 * Represents 24hr ticker information.
 * 
 * @interface Ticker
 * @property symbol - Trading pair symbol
 * @property bid - Best bid price
 * @property ask - Best ask price
 * @property last - Last traded price
 * @property volume24h - 24hr trading volume
 * @property timestamp - When the data was captured
 */
export interface Ticker {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume24h: number;
  timestamp: Date;
}

/**
 * Creates a Ticker from raw exchange data.
 * 
 * @param data - Raw ticker data from exchange
 * @param symbol - Trading symbol
 * @returns Normalized Ticker object
 * 
 * @example
 * const ticker = createTicker({ b: '49999', a: '50000', c: '50000' }, 'BTCUSDT');
 */
export function createTicker(data: { bidPrice?: string; askPrice?: string; lastPrice?: string; volume?: string; closeTime?: number }, symbol: string): Ticker {
  return {
    symbol: symbol.toUpperCase(),
    bid: parseFloat(data.bidPrice || '0'),
    ask: parseFloat(data.askPrice || '0'),
    last: parseFloat(data.lastPrice || '0'),
    volume24h: parseFloat(data.volume || '0'),
    timestamp: new Date(data.closeTime || Date.now()),
  };
}