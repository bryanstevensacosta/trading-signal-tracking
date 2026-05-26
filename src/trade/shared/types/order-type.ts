/**
 * Order execution types for trade entry.
 */
export enum OrderType {
  /**
   * Market Order - Executes immediately at current market price.
   * No waiting, uses current price as entryExecutedPrice.
   */
  MARKET = 'market',

  /**
   * Limit Order - Waits for price to reach entry level.
   * Fills at entry price or better (if market price is better than limit).
   * 
   * For LONG/BUY: If current price < entry, fills at current price.
   * For SHORT/SELL: If current price > entry, fills at current price.
   */
  LIMIT = 'limit',
}