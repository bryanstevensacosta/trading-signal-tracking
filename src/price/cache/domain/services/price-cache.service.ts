import { Injectable } from '@nestjs/common';
import { PriceCachePort } from '../ports/price-cache.port';
import { Price } from '@trade/shared';

/**
 * Service for managing in-memory price cache.
 * Provides fast access to current prices for trading decisions.
 */
@Injectable()
export class PriceCacheService implements PriceCachePort {
  private cache: Map<string, Price> = new Map();

  /**
   * Sets a price in the cache with normalized symbol.
   * @param price - The price data to cache
   */
  set(price: Price): void {
    if (!price?.symbol) {
      return;
    }
    const upperSymbol = price.symbol.toUpperCase();
    this.cache.set(upperSymbol, {
      ...price,
      symbol: upperSymbol,
      timestamp: new Date(),
    });
  }

  /**
   * Gets a price from the cache by symbol.
   * @param symbol - The trading symbol
   * @returns The cached price or null if not found
   */
  get(symbol: string): Price | null {
    return this.cache.get(symbol.toUpperCase()) || null;
  }

  /**
   * Gets all cached prices.
   * @returns Array of all cached prices
   */
  getAll(): Price[] {
    return Array.from(this.cache.values());
  }

  /**
   * Removes a price from the cache.
   * @param symbol - The trading symbol
   */
  remove(symbol: string): void {
    this.cache.delete(symbol.toUpperCase());
  }

  /**
   * Clears all cached prices.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Checks if a symbol is cached.
   * @param symbol - The trading symbol
   * @returns True if cached
   */
  has(symbol: string): boolean {
    return this.cache.has(symbol.toUpperCase());
  }

  /**
   * Gets the number of cached prices.
   * @returns Cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Gets prices for multiple symbols.
   * @param symbols - Array of trading symbols
   * @returns Array of cached prices (null entries filtered out)
   */
  getBySymbols(symbols: string[]): Price[] {
    return symbols
      .map(symbol => this.get(symbol))
      .filter((price): price is Price => price !== null);
  }
}