import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { PriceStreamPort, SubscriptionInfo } from '../ports/price-stream.port';
import { Price } from '@trade/shared';
import { PriceUpdatedEvent } from '../events/price-updated.event';
import { SPOT_PORT, FUTURES_PORT } from '@price/provider/binance/tokens';
import type { BinanceSpotPort } from '@price/provider/binance/domain/ports/binance-spot.port';
import type { BinanceFuturesPort } from '@price/provider/binance/domain/ports/binance-futures.port';
import { LoggerPort, LOGGER_PORT } from '@shared/domain/ports/logger.port';

export type MarketType = 'spot' | 'futures';

/**
 * Price Stream Service.
 * Manages WebSocket subscriptions to real-time price updates.
 * 
 * @remarks
 * For historical klines and current ticker prices, use @price/provider/binance directly.
 * This service is solely responsible for streaming price updates via WebSocket.
 */
@Injectable()
export class PriceStreamService implements PriceStreamPort {
  private subscriptions: Map<string, SubscriptionInfo> = new Map();

  constructor(
    @Inject(forwardRef(() => SPOT_PORT)) private readonly spotExchange: BinanceSpotPort,
    @Inject(forwardRef(() => FUTURES_PORT)) private readonly futuresExchange: BinanceFuturesPort,
    private readonly eventBus: EventBus,
    @Inject(LOGGER_PORT) private readonly logger: LoggerPort,
  ) {}

  subscribe(symbol: string, callback: (price: Price) => void, marketType: MarketType = 'spot'): SubscriptionInfo {
    const upperSymbol = symbol.toUpperCase();
    this.logger.debug(`[PriceStream] subscribe: symbol=${upperSymbol}, marketType=${marketType}, alreadySubscribed=${this.subscriptions.has(upperSymbol)}`);

    if (this.subscriptions.has(upperSymbol)) {
      this.logger.debug(`[PriceStream] Already subscribed to ${upperSymbol}, returning existing subscription`);
      return this.subscriptions.get(upperSymbol)!;
    }

    const exchange = marketType === 'futures' ? this.futuresExchange : this.spotExchange;
    const unsubscribe = exchange.subscribeToTicker(upperSymbol, (price: Price) => {
      this.logger.debug(`[PriceStream] Received price update for ${price.symbol}: last=${price.last}, bid=${price.bid}, ask=${price.ask}`);
      this.handlePriceUpdate(price);
      callback(price);
    });

    const subscription: SubscriptionInfo = {
      symbol: upperSymbol,
      unsubscribe,
      subscribedAt: new Date(),
    };

    this.subscriptions.set(upperSymbol, subscription);
    this.logger.debug(`[PriceStream] New subscription created for ${upperSymbol}`);
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

  private async handlePriceUpdate(price: Price): Promise<void> {
    await this.eventBus.publish(new PriceUpdatedEvent(price));
  }
}