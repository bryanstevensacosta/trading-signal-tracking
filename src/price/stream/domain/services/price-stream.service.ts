import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { PriceStreamPort, SubscriptionInfo } from '../ports/price-stream.port';
import { Price } from '@trade/shared';
import { PriceUpdatedEvent } from '../events/price-updated.event';
import { SPOT_PORT, FUTURES_PORT } from '@price/exchange/tokens';
import type { BinanceSpotPort } from '@price/exchange/domain/ports/binance-spot.port';
import type { BinanceFuturesPort } from '@price/exchange/domain/ports/binance-futures.port';

export type MarketType = 'spot' | 'futures';

@Injectable()
export class PriceStreamService implements PriceStreamPort {
  private subscriptions: Map<string, SubscriptionInfo> = new Map();

  constructor(
    @Inject(forwardRef(() => SPOT_PORT)) private readonly spotExchange: BinanceSpotPort,
    @Inject(forwardRef(() => FUTURES_PORT)) private readonly futuresExchange: BinanceFuturesPort,
    private readonly eventBus: EventBus,
  ) {}

  subscribe(symbol: string, callback: (price: Price) => void, marketType: MarketType = 'spot'): SubscriptionInfo {
    const upperSymbol = symbol.toUpperCase();

    if (this.subscriptions.has(upperSymbol)) {
      return this.subscriptions.get(upperSymbol)!;
    }

    const exchange = marketType === 'futures' ? this.futuresExchange : this.spotExchange;
    const unsubscribe = exchange.subscribeToTicker(upperSymbol, (price: Price) => {
      this.handlePriceUpdate(price);
      callback(price);
    });

    const subscription: SubscriptionInfo = {
      symbol: upperSymbol,
      unsubscribe,
      subscribedAt: new Date(),
    };

    this.subscriptions.set(upperSymbol, subscription);
    return subscription;
  }

  unsubscribe(symbol: string): void {
    const upperSymbol = symbol.toUpperCase();
    const subscription = this.subscriptions.get(upperSymbol);

    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(upperSymbol);
    }
  }

  unsubscribeAll(): void {
    this.subscriptions.forEach((sub) => {
      sub.unsubscribe();
    });
    this.subscriptions.clear();
  }

  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  isSubscribed(symbol: string): boolean {
    return this.subscriptions.has(symbol.toUpperCase());
  }

  async getCurrentPrice(symbol: string, marketType: MarketType = 'spot'): Promise<Price | null> {
    try {
      const exchange = marketType === 'futures' ? this.futuresExchange : this.spotExchange;
      return await exchange.getTicker(symbol);
    } catch {
      return null;
    }
  }

  private async handlePriceUpdate(price: Price): Promise<void> {
    await this.eventBus.publish(new PriceUpdatedEvent(price));
  }
}