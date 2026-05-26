/**
 * Market type for determining if trade is spot or futures.
 */
export enum MarketType {
  SPOT = 'spot',
  FUTURES = 'futures',
}

/**
 * Price data for a trading symbol.
 */
export interface Price {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  timestamp: Date;
  exchange?: string;
  marketType?: MarketType;
}

/**
 * Price data with explicitly required exchange and market type.
 * @extends Price
 */
export interface PriceWithExchange extends Price {
  exchange: string;
  marketType: MarketType;
}