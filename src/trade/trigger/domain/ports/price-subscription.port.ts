import { Price } from '@trade/shared';

/**
 * Port interface for price subscription in trade engine.
 * Abstracts the price stream service for the engine domain.
 */
export interface PriceSubscriptionPort {
  subscribe(symbol: string, callback: (price: Price) => void): () => void;
  unsubscribe(symbol: string): void;
  getActiveSymbols(): string[];
}