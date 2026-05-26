import { Injectable, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import { EventBus, CommandBus } from '@nestjs/cqrs';
import { Trade, Price, OrderType, TradeStatus } from '@trade/shared';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '../../../repository/domain/ports/trade-repository.port';
import { PriceStreamService } from '@price/stream/domain/services/price-stream.service';
import { TriggerDetectorService } from './trigger-detector.service';
import { MonitoringStartedEvent, MonitoringStoppedEvent, TriggerDetectedEvent } from '../events';
import { LoggerPort, LOGGER_PORT } from '../../../../shared/domain/ports/logger.port';

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

    if (!this.monitoredSymbols.has(symbol)) {
      const callback = (price: Price) => {
        this.onPriceUpdateForSymbol(symbol, price);
      };

      this.priceCallbacks.set(symbol, callback);
      this.priceStream.subscribe(symbol, callback);
      this.monitoredSymbols.add(symbol);
    }

    this.eventBus.publish(new MonitoringStartedEvent(trade));
  }

  /**
   * Stops monitoring a trade.
   */
  async stopMonitoring(trade: Trade, reason: string = 'stopped'): Promise<void> {
    const symbol = trade.symbol.toUpperCase();
    const otherTrades = await this.repository.findBySymbol(symbol);

    const stillActive = otherTrades.filter(
      t => t.id !== trade.id && MONITORED_STATUSES.includes(t.status)
    );

    if (stillActive.length === 0) {
      const callback = this.priceCallbacks.get(symbol);
      if (callback) {
        this.priceStream.unsubscribe(symbol);
        this.priceCallbacks.delete(symbol);
        this.monitoredSymbols.delete(symbol);
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
    const symbols = [...new Set(allTrades.map(t => t.symbol.toUpperCase()))];

    this.logger.info(`[TradingEngine] startMonitoringAll: ${allTrades.length} trades (${symbols.length} unique symbols)`);

    for (const symbol of symbols) {
      if (!this.monitoredSymbols.has(symbol)) {
        const callback = (price: Price) => {
          this.onPriceUpdateForSymbol(symbol, price);
        };

        this.priceCallbacks.set(symbol, callback);
        this.priceStream.subscribe(symbol, callback);
        this.monitoredSymbols.add(symbol);
        this.logger.info(`[TradingEngine] Subscribed to ${symbol}`);
      }
    }
  }

  /**
   * Stops all monitoring.
   */
  async stopAllMonitoring(): Promise<void> {
    for (const symbol of this.monitoredSymbols) {
      const callback = this.priceCallbacks.get(symbol);
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
  async onPriceUpdateForSymbol(symbol: string, price: Price): Promise<void> {
    if (!symbol || !price) {
      return;
    }
    const trades = await this.repository.findBySymbol(symbol);

    for (const trade of trades) {
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
          new TriggerDetectedEvent(trade, result.trigger!, result.price!, result.rr, result.tpIndex)
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
    return this.monitoredSymbols.has(symbol.toUpperCase());
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

      const price = await this.priceStream.getCurrentPrice(trade.symbol);
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