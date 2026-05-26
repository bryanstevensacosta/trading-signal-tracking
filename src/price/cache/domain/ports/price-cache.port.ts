import { Price } from '@trade/shared';

export const PRICE_CACHE_PORT = 'PRICE_CACHE_PORT';

/**
 * Port for price cache operations.
 * Defines the contract for caching price data in memory.
 */
export interface PriceCachePort {
  /**
   * Sets a price in the cache.
   * @param price - The price data to cache
   */
  set(price: Price): void;

  /**
   * Gets a price from the cache by symbol.
   * @param symbol - The trading symbol
   * @returns The cached price or null if not found
   */
  get(symbol: string): Price | null;

  /**
   * Gets all cached prices.
   * @returns Array of all cached prices
   */
  getAll(): Price[];

  /**
   * Removes a price from the cache.
   * @param symbol - The trading symbol
   */
  remove(symbol: string): void;

  /**
   * Clears all cached prices.
   */
  clear(): void;

  /**
   * Checks if a symbol is cached.
   * @param symbol - The trading symbol
   * @returns True if cached
   */
  has(symbol: string): boolean;

  /**
   * Gets the number of cached prices.
   * @returns Cache size
   */
  size(): number;

  /**
   * Gets prices for multiple symbols.
   * @param symbols - Array of trading symbols
   * @returns Array of cached prices (null entries filtered out)
   */
  getBySymbols(symbols: string[]): Price[];
}