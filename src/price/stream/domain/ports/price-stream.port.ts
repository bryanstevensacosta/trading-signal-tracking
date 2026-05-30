import { Price } from '@trade/shared';
import type { MarketType } from '../services/price-stream.service';

/**
 * Subscription information for a symbol.
 */
export interface SubscriptionInfo {
  symbol: string;
  unsubscribe: () => void;
  subscribedAt: Date;
}

/**
 * Port interface for price streaming.
 * Defines the contract for subscribing to real-time price updates.
 */
export interface PriceStreamPort {
  subscribe(symbol: string, callback: (price: Price) => void, marketType?: MarketType): SubscriptionInfo;
  unsubscribe(symbol: string): void;
  unsubscribeAll(): void;
  getActiveSubscriptions(): string[];
  isSubscribed(symbol: string): boolean;
  getCurrentPrice(symbol: string, marketType?: MarketType): Promise<Price | null>;
}