import { Injectable, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import { EventBus, CommandBus } from '@nestjs/cqrs';
import { Trade, Price, OrderType, TriggerType } from '@trade/shared';
import { TradeSide } from '@trade/shared/types/trigger';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '../../../repository/domain/ports/trade-repository.port';
import { PriceStreamService, MarketType } from '@price/stream/domain/services/price-stream.service';
import { TriggerDetectorService } from './trigger-detector.service';
import { RunRecoveryCommand } from '@recovery/application/commands';
import { MonitoringStartedEvent, MonitoringStoppedEvent, TriggerDetectedEvent } from '../events';
import { LoggerPort, LOGGER_PORT } from '../../../../shared/domain/ports/logger.port';
import { SPOT_PORT, FUTURES_PORT } from '@price/provider/binance/tokens';
import type { BinanceSpotPort } from '@price/provider/binance/domain/ports/binance-spot.port';
import type { BinanceFuturesPort } from '@price/provider/binance/domain/ports/binance-futures.port';

function getMarketType(side: TradeSide): MarketType {
  return side === TradeSide.SPOT ? 'spot' : 'futures';
}

const MONITORED_STATUSES = ['pending', 'active', 'partial_tp', 'breakeven'];

/**
 * Domain service for monitoring trades and detecting price triggers.
 * Subscribes to price streams and emits events when triggers are hit.
 */
@Injectable()
export class TriggerOrchestratorService implements OnModuleInit {
  private monitoredSymbols: Set<string> = new Set();
  private priceCallbacks: Map<string, (price: Price) => void> = new Map();
  private recentTriggers: Map<string, number> = new Map();
  private debugLogsSent: Map<string, number> = new Map();
  private readonly TRIGGER_COOLDOWN_MS = 1000;
  private readonly DEBUG_LOG_COOLDOWN_MS = 60000;

  constructor(
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    @Inject(forwardRef(() => PriceStreamService))
    private readonly priceStream: PriceStreamService,
    private readonly triggerDetector: TriggerDetectorService,
    private readonly eventBus: EventBus,
    private readonly commandBus: CommandBus,
    @Inject(LOGGER_PORT) private readonly logger: LoggerPort,
    @Inject(SPOT_PORT) private readonly spotExchange: BinanceSpotPort,
    @Inject(FUTURES_PORT) private readonly futuresExchange: BinanceFuturesPort,
  ) {}

  private getExchange(side: TradeSide): BinanceSpotPort | BinanceFuturesPort {
    return side === TradeSide.SPOT ? this.spotExchange : this.futuresExchange;
  }

  /**
   * Starts monitoring a single trade.
   */
  async startMonitoring(trade: Trade): Promise<void> {
    const startTime = Date.now();
    const symbol = trade.symbol.toUpperCase();
    const marketType = getMarketType(trade.side);
    const subscriptionKey = `${symbol}-${marketType}`;

    this.logger.info(`[TriggerOrchestrator] startMonitoring: tradeId=${trade.id} (${symbol}) status=${trade.status}, entry=${trade.entry}, side=${trade.side}, orderType=${trade.orderType}, startTime=${startTime}`);

    if (!this.monitoredSymbols.has(subscriptionKey)) {
      const subscribeStart = Date.now();
      const callback = (price: Price) => {
        this.logger.debug(`[TriggerOrchestrator] Callback invoked for ${subscriptionKey}: price=${price.last}`);
        this.onPriceUpdateForSymbol(subscriptionKey, price, trade.side);
      };

      this.priceCallbacks.set(subscriptionKey, callback);
      this.logger.info(`[TriggerOrchestrator] Calling priceStream.subscribe for ${symbol} with marketType=${marketType}`);
      this.priceStream.subscribe(symbol, callback, marketType);
      const subscribeEnd = Date.now();
      this.logger.info(`[TriggerOrchestrator] WebSocket subscribe completed: symbol=${symbol}, market=${marketType}, duration=${subscribeEnd - subscribeStart}ms`);
      this.monitoredSymbols.add(subscriptionKey);
    } else {
      this.logger.info(`[TriggerOrchestrator] Already subscribed: symbol=${symbol}, market=${marketType}, monitoredSymbols=${Array.from(this.monitoredSymbols).join(', ')}`);
    }

    await this.checkInitialTrigger(trade);

    const endTime = Date.now();
    this.logger.info(`[PERF] startMonitoring END: tradeId=${trade.id}, duration=${endTime - startTime}ms`);

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
      this.logger.warn(`[TriggerOrchestrator] Invalid price update: subscriptionKey=${subscriptionKey}, price=${JSON.stringify(price)}`);
      return;
    }
    const [symbol] = subscriptionKey.split('-');
    this.logger.debug(`[TriggerOrchestrator] >>> PriceUpdate received: symbol=${symbol}, price=${price.last}, bid=${price.bid}, ask=${price.ask}, side=${side}, subscriptionKey=${subscriptionKey}`);

    const trades = await this.repository.findBySymbol(symbol);

    this.logger.debug(`[TriggerOrchestrator] Found ${trades.length} trades for ${symbol}: ${trades.map(t => `${t.id}(${t.status})`).join(', ')}`);

    const relevantTrades = side
      ? trades.filter(t => getMarketType(t.side) === getMarketType(side))
      : trades;

    this.logger.debug(`[TriggerOrchestrator] Relevant trades for ${symbol} with side ${side}: ${relevantTrades.length}`);

    for (const trade of relevantTrades) {
      if (!MONITORED_STATUSES.includes(trade.status)) continue;

      const checkStart = Date.now();
      const result = this.triggerDetector.checkAllTriggers(trade, price);
      const checkDuration = Date.now() - checkStart;
      if (result.triggered) {
        this.logger.info(`[PERF] TriggerCheck: tradeId=${trade.id}, trigger=${result.trigger}, checkDuration=${checkDuration}ms`);
      }

      // Debug logs for near-entry/SL/TP (cooldown 60s to avoid spam)
      if (!result.triggered && (result.nearEntry || result.nearTP || result.nearSL)) {
        const debugKey = `${trade.id}-debug`;
        const lastDebug = this.debugLogsSent.get(debugKey) || 0;
        const now = Date.now();

        if (now - lastDebug >= this.DEBUG_LOG_COOLDOWN_MS) {
          this.debugLogsSent.set(debugKey, now);
          if (result.nearEntry) {
            this.logger.info(`[DEBUG] ${trade.status.toUpperCase()} ${trade.side} ${symbol}: price ${price.last} near ENTRY ${trade.entry}`);
          } else if (result.nearTP) {
            this.logger.info(`[DEBUG] ${trade.status.toUpperCase()} ${trade.side} ${symbol}: price ${price.last} near TP ${trade.tps?.join(', ')}`);
          } else if (result.nearSL) {
            this.logger.info(`[DEBUG] ${trade.status.toUpperCase()} ${trade.side} ${symbol}: price ${price.last} near SL ${trade.sl}`);
          }
        }
      }

      if (result.triggered) {
        const triggerKey = `${trade.id}-${result.trigger}`;
        const now = Date.now();
        const lastTriggered = this.recentTriggers.get(triggerKey) || 0;

        if (now - lastTriggered < this.TRIGGER_COOLDOWN_MS) {
          continue;
        }
        this.recentTriggers.set(triggerKey, now);

        // Update lastSeenTimestamp to track when trade was last processed
        await this.repository.update(trade.id, {
          lastSeenTimestamp: new Date(),
        });

        this.logger.info(`[PERF] TRIGGER DETECTED: tradeId=${trade.id}, trigger=${result.trigger}, symbol=${symbol}, price=${price.last}, timestamp=${Date.now()}`);
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
   * Checks if entry trigger was already hit when starting to monitor a trade.
   * Uses recent klines to detect missed triggers that occurred before WebSocket subscription.
   */
  private async checkInitialTrigger(trade: Trade): Promise<void> {
    const freshTrade = await this.repository.findById(trade.id);
    
    if (!freshTrade) {
      this.logger.debug(`[InitialTrigger] Trade ${trade.id} not found in DB`);
      return;
    }

    if (freshTrade.status !== 'pending') {
      this.logger.debug(`[InitialTrigger] ${trade.symbol}: Trade status is ${freshTrade.status}, skipping initial trigger check`);
      return;
    }

    if (freshTrade.orderType !== OrderType.LIMIT) {
      this.logger.debug(`[InitialTrigger] ${trade.symbol}: Order type is ${freshTrade.orderType}, skipping initial trigger check`);
      return;
    }

    if (freshTrade.entryExecutedAt) {
      this.logger.debug(`[InitialTrigger] ${trade.symbol}: Entry already executed at ${freshTrade.entryExecutedAt}, skipping`);
      return;
    }

    const now = Date.now();
    const startTime = Math.max(now - 900000, freshTrade.createdAt.getTime());
    const endTime = now;

    const exchange = this.getExchange(freshTrade.side);

    try {
      const klines = await exchange.getKlines(
        freshTrade.symbol,
        '1m',
        startTime,
        endTime,
        15
      );

      if (!klines || klines.length === 0) {
        this.logger.debug(`[InitialTrigger] No klines for ${freshTrade.symbol}`);
        return;
      }

      const entry = freshTrade.entry;
      let triggered = false;
      let triggerPrice = entry;

      for (const candle of klines) {
        if (freshTrade.side === TradeSide.LONG || freshTrade.side === TradeSide.SPOT) {
          if (candle.low <= entry) {
            triggered = true;
            triggerPrice = entry;
            break;
          }
        } else if (freshTrade.side === TradeSide.SHORT) {
          if (candle.high >= entry) {
            triggered = true;
            triggerPrice = entry;
            break;
          }
        }
      }

      if (triggered) {
        this.logger.info(`[InitialTrigger] ${freshTrade.symbol}: Entry hit at ${triggerPrice} (checking recent klines)`);
        await this.eventBus.publish(
          new TriggerDetectedEvent(freshTrade, TriggerType.ENTRY, triggerPrice, undefined, undefined, undefined)
        );
      }
    } catch (error) {
      this.logger.warn(`[InitialTrigger] Failed to check klines for ${freshTrade.symbol}: ${error}`);
    }
  }

  /**
   * On module init, recover any missed entry triggers for LIMIT orders.
   * Uses klines historical data to check if price touched entry while server was down.
   * Deferred to ensure event handlers are registered.
   */
  async onModuleInit(): Promise<void> {
    setTimeout(async () => {
      this.logger.info('[TradingEngine] Starting recovery check for missed triggers...');
      const result = await this.commandBus.execute(new RunRecoveryCommand());
      this.logger.info(`[TradingEngine] Recovery complete. ${result.triggers.size} triggers detected, ${result.fixedStates} states fixed.`);
      
      await this.startMonitoringAll();
    }, 2000);
  }
}