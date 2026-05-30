import { Injectable, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import { EventBus, CommandBus } from '@nestjs/cqrs';
import { Trade, Price, OrderType, TradeStatus } from '@trade/shared';
import { TradeSide } from '@trade/shared/types/trigger';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '../../../repository/domain/ports/trade-repository.port';
import { PriceStreamService, MarketType } from '@price/stream/domain/services/price-stream.service';
import { TriggerDetectorService } from './trigger-detector.service';
import { MonitoringStartedEvent, MonitoringStoppedEvent, TriggerDetectedEvent } from '../events';
import { LoggerPort, LOGGER_PORT } from '../../../../shared/domain/ports/logger.port';

function getMarketType(side: TradeSide): MarketType {
  return side === TradeSide.SPOT ? 'spot' : 'futures';
}

const MONITORED_STATUSES = ['pending', 'active', 'partial_tp', 'breakeven'];

/**
 * Domain service for monitoring trades and detecting price triggers.
 * Subscribes to price streams and emits events when triggers are hit.
 */
@Injectable()
export class TradingEngineService implements OnModuleInit {
  private monitoredSymbols: Set<string> = new Set();
  private priceCallbacks: Map<string, (price: Price) => void> = new Map();
  private recentTriggers: Map<string, number> = new Map();
  private readonly TRIGGER_COOLDOWN_MS = 1000;

  constructor(
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    @Inject(forwardRef(() => PriceStreamService))
    private readonly priceStream: PriceStreamService,
    private readonly triggerDetector: TriggerDetectorService,
    private readonly eventBus: EventBus,
    private readonly commandBus: CommandBus,
    @Inject(LOGGER_PORT) private readonly logger: LoggerPort,
  ) {}

  /**
   * Starts monitoring a single trade.
   */
  async startMonitoring(trade: Trade): Promise<void> {
    const symbol = trade.symbol.toUpperCase();
    const marketType = getMarketType(trade.side);
    const subscriptionKey = `${symbol}-${marketType}`;

    this.logger.info(`[TradingEngine] startMonitoring: ${trade.id} (${symbol}) status=${trade.status}, side=${trade.side}, market=${marketType}`);

    if (!this.monitoredSymbols.has(subscriptionKey)) {
      const callback = (price: Price) => {
        this.onPriceUpdateForSymbol(subscriptionKey, price, trade.side);
      };

      this.priceCallbacks.set(subscriptionKey, callback);
      this.priceStream.subscribe(symbol, callback, marketType);
      this.monitoredSymbols.add(subscriptionKey);
    }

    this.eventBus.publish(new MonitoringStartedEvent(trade));
  }

  /**
   * Stops monitoring a trade.
   */
  async stopMonitoring(trade: Trade, reason: string = 'stopped'): Promise<void> {
    const symbol = trade.symbol.toUpperCase();
    const marketType = getMarketType(trade.side);
    const subscriptionKey = `${symbol}-${marketType}`;
    const otherTrades = await this.repository.findBySymbol(symbol);

    const stillActive = otherTrades.filter(
      t => t.id !== trade.id && MONITORED_STATUSES.includes(t.status) && getMarketType(t.side) === marketType
    );

    if (stillActive.length === 0) {
      const callback = this.priceCallbacks.get(subscriptionKey);
      if (callback) {
        this.priceStream.unsubscribe(symbol);
        this.priceCallbacks.delete(subscriptionKey);
        this.monitoredSymbols.delete(subscriptionKey);
      }
    }

    this.eventBus.publish(new MonitoringStoppedEvent(trade, reason));
  }

  /**
   * Starts monitoring all active and pending trades.
   */
  async startMonitoringAll(): Promise<void> {
    const [activeTrades, pendingTrades] = await Promise.all([
      this.repository.findActive(),
      this.repository.findPending(),
    ]);

    const allTrades = [...activeTrades, ...pendingTrades];
    const symbolsAndMarkets = new Map<string, Set<MarketType>>();

    for (const trade of allTrades) {
      const symbol = trade.symbol.toUpperCase();
      const marketType = getMarketType(trade.side);
      if (!symbolsAndMarkets.has(symbol)) {
        symbolsAndMarkets.set(symbol, new Set());
      }
      symbolsAndMarkets.get(symbol)!.add(marketType);
    }

    this.logger.info(`[TradingEngine] startMonitoringAll: ${allTrades.length} trades (${symbolsAndMarkets.size} unique symbols)`);

    for (const [symbol, marketTypes] of symbolsAndMarkets) {
      for (const marketType of marketTypes) {
        const subscriptionKey = `${symbol}-${marketType}`;
        const firstTradeForSymbol = allTrades.find(t => t.symbol.toUpperCase() === symbol && getMarketType(t.side) === marketType);
        const side = firstTradeForSymbol?.side;
        if (!this.monitoredSymbols.has(subscriptionKey)) {
          const callback = (price: Price) => {
            this.onPriceUpdateForSymbol(subscriptionKey, price, side);
          };

          this.priceCallbacks.set(subscriptionKey, callback);
          this.priceStream.subscribe(symbol, callback, marketType);
          this.monitoredSymbols.add(subscriptionKey);
          this.logger.info(`[TradingEngine] Subscribed to ${symbol} (${marketType})`);
        }
      }
    }
  }

  /**
   * Stops all monitoring.
   */
  async stopAllMonitoring(): Promise<void> {
    for (const subscriptionKey of this.monitoredSymbols) {
      const [symbol] = subscriptionKey.split('-');
      const callback = this.priceCallbacks.get(subscriptionKey);
      if (callback) {
        this.priceStream.unsubscribe(symbol);
      }
    }

    this.monitoredSymbols.clear();
    this.priceCallbacks.clear();
  }

  /**
   * Handles price update for a specific symbol.
   */
  async onPriceUpdateForSymbol(subscriptionKey: string, price: Price, side?: TradeSide): Promise<void> {
    if (!subscriptionKey || !price) {
      return;
    }
    const [symbol] = subscriptionKey.split('-');
    const trades = await this.repository.findBySymbol(symbol);

    const relevantTrades = side
      ? trades.filter(t => getMarketType(t.side) === getMarketType(side))
      : trades;

    for (const trade of relevantTrades) {
      if (!MONITORED_STATUSES.includes(trade.status)) continue;

      const result = this.triggerDetector.checkAllTriggers(trade, price);

      if (result.triggered) {
        const triggerKey = `${trade.id}-${result.trigger}`;
        const now = Date.now();
        const lastTriggered = this.recentTriggers.get(triggerKey) || 0;

        if (now - lastTriggered < this.TRIGGER_COOLDOWN_MS) {
          continue;
        }
        this.recentTriggers.set(triggerKey, now);

        this.logger.info(`[TradingEngine] TRIGGER DETECTED: tradeId=${trade.id}, trigger=${result.trigger}, symbol=${symbol}`);
        await this.eventBus.publish(
          new TriggerDetectedEvent(trade, result.trigger!, result.price!, result.rr, result.tpIndex, result.lastTpIndex)
        );
      }
    }
  }

  /**
   * Gets list of currently monitored symbols.
   */
  getMonitoredSymbols(): string[] {
    return Array.from(this.monitoredSymbols);
  }

  /**
   * Checks if a symbol is being monitored.
   */
  isMonitoring(symbol: string): boolean {
    const upperSymbol = symbol.toUpperCase();
    return Array.from(this.monitoredSymbols).some(key => key.startsWith(upperSymbol + '-'));
  }

  /**
   * On module init, recover any missed entry triggers for LIMIT orders.
   * This handles the case where the app was restarted while LIMIT orders were pending.
   */
  async onModuleInit(): Promise<void> {
    await this.recoverMissedEntries();
    await this.startMonitoringAll();
  }

  private async recoverMissedEntries(): Promise<void> {
    const pendingTrades = await this.repository.findPending();

    for (const trade of pendingTrades) {
      if (trade.orderType !== OrderType.LIMIT) {
        continue;
      }

      if (trade.entryExecutedAt) {
        continue;
      }

      const marketType = getMarketType(trade.side);
      const price = await this.priceStream.getCurrentPrice(trade.symbol, marketType);
      if (!price) {
        continue;
      }

      const entryHit = this.triggerDetector.checkEntryHit(trade, price);

      if (entryHit.triggered) {
        await this.repository.update(trade.id, {
          status: TradeStatus.ACTIVE,
          entryExecutedAt: new Date(),
          entryExecutedPrice: entryHit.price,
        });
      }
    }
  }
}