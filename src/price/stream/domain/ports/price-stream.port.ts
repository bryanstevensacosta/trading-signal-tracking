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
 * Manages real-time price subscriptions via WebSocket.
 * 
 * @remarks
 * For historical data (klines) and current prices, use @price/provider/binance directly.
 */
export interface PriceStreamPort {
  subscribe(symbol: string, callback: (price: Price) => void, marketType?: MarketType): SubscriptionInfo;
  unsubscribe(symbol: string): void;
  unsubscribeAll(): void;
  getActiveSubscriptions(): string[];
  isSubscribed(symbol: string): boolean;
}