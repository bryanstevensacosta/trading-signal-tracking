import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { Trade, OrderType, TradeSide, TriggerType, TradeStatus } from '@trade/shared';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '../../repository/domain/ports/trade-repository.port';
import { PriceStreamService, MarketType as StreamMarketType } from '@price/stream/domain/services/price-stream.service';
import { TriggerDetectorService, TriggerResult } from '../domain/services/trigger-detector.service';
import { TriggerDetectedEvent } from '../domain/events/trigger-detected.event';
import { LoggerPort, LOGGER_PORT } from '../../../shared/domain/ports/logger.port';

interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

/**
 * Service responsible for recovering missed triggers on application startup.
 * Uses historical klines to check if price touched entry while server was down.
 * When a trigger is detected, publishes TriggerDetectedEvent for processing.
 */
@Injectable()
export class RecoveryService {
  private readonly logger: LoggerPort;

  constructor(
    @Inject(TRADE_REPOSITORY_PORT) private readonly tradeRepository: TradeRepositoryPort,
    @Inject(forwardRef(() => PriceStreamService))
    private readonly priceStream: PriceStreamService,
    private readonly triggerDetector: TriggerDetectorService,
    private readonly eventBus: EventBus,
    @Inject(LOGGER_PORT) logger: LoggerPort,
  ) {
    this.logger = logger;
  }

  /**
   * Recovers missed triggers for all pending/active trades.
   * Uses klines historical data to check if price touched entry/TP/SL while server was down.
   * When triggers are detected, publishes events for processing.
   */
  async recoverMissedTriggers(): Promise<Map<string, TriggerResult>> {
    const results = new Map<string, TriggerResult>();

    const pendingTrades = await this.tradeRepository.findPending();

    this.logger.info(`Checking ${pendingTrades.length} pending trades for missed triggers`);

    for (const trade of pendingTrades) {
      this.logger.info(`[Recovery] Checking trade ${trade.id}, status=${trade.status}, lastSeen=${trade.lastSeenTimestamp}, entryExecutedAt=${trade.entryExecutedAt}`);
      
      const result = await this.checkTradeForMissedTriggers(trade);
      this.logger.info(`[Recovery] Result for ${trade.id}: triggered=${result.triggered}, trigger=${result.trigger}`);

      if (result.triggered && result.trigger && result.price != null) {
        results.set(trade.id, result);
        this.logger.info(
          `Trade ${trade.id} (${trade.symbol}): ${result.trigger} trigger detected at ${result.price}`,
        );

        const freshTrade = await this.tradeRepository.findById(trade.id);
        this.logger.info(`[Recovery] Trade ${trade.id} current status before event: ${freshTrade?.status}`);

        // Execute state transition directly via repository
        if (result.trigger === TriggerType.ENTRY) {
          // Check if we already have entryExecutedAt (fixing inconsistent state)
          const existingTrade = await this.tradeRepository.findById(trade.id);
          const existingEntryExecutedAt = existingTrade?.entryExecutedAt;
          
          await this.tradeRepository.update(trade.id, {
            status: TradeStatus.ACTIVE,
            entryExecutedPrice: existingTrade?.entryExecutedPrice || result.price,
            entryExecutedAt: existingEntryExecutedAt || new Date(),
          });
          this.logger.info(`[Recovery] Entry triggered - transitioned trade ${trade.id} to ACTIVE`);

          // After activating, check if SL was already hit
          const activeTrade = await this.tradeRepository.findById(trade.id);
          if (activeTrade?.sl) {
            const currentPrice = await this.priceStream.getCurrentPrice(trade.symbol, trade.side === TradeSide.SPOT ? 'spot' : 'futures');
            if (currentPrice) {
              const isLong = activeTrade.side === TradeSide.LONG || activeTrade.side === TradeSide.SPOT;
              const priceForSl = isLong ? currentPrice.bid : currentPrice.ask;
              const slHit = isLong ? priceForSl <= activeTrade.sl : priceForSl >= activeTrade.sl;
              
              if (slHit) {
                this.logger.info(`[Recovery] SL already hit for trade ${trade.id}, closing...`);
                await this.tradeRepository.update(trade.id, {
                  status: TradeStatus.CLOSED_LOSS,
                  closedAt: new Date(),
                });
                this.logger.info(`[Recovery] Trade ${trade.id} closed as LOSS`);
              }
            }
          }
        } else if (result.trigger === TriggerType.TP) {
          await this.tradeRepository.update(trade.id, {
            status: TradeStatus.CLOSED_WIN,
            tpsHit: [result.tpIndex!],
            closedAt: new Date(),
          });
          this.logger.info(`[Recovery] TP triggered - closed trade ${trade.id} as WIN`);
        } else if (result.trigger === TriggerType.SL) {
          await this.tradeRepository.update(trade.id, {
            status: TradeStatus.CLOSED_LOSS,
            closedAt: new Date(),
          });
          this.logger.info(`[Recovery] SL triggered - closed trade ${trade.id} as LOSS`);
        }

        // Also publish event for notifications
        const updatedTrade = await this.tradeRepository.findById(trade.id);
        const event = new TriggerDetectedEvent(
          updatedTrade!,
          result.trigger,
          result.price,
          result.rr,
          result.tpIndex,
          result.lastTpIndex,
        );
        await this.eventBus.publish(event);
      }
    }

    const activeTrades = await this.tradeRepository.findByStatus('active');
    for (const trade of activeTrades) {
      const result = await this.checkActiveTradeForMissedTriggers(trade);

      if (result.triggered && result.trigger && result.price != null) {
        results.set(trade.id, result);
        this.logger.info(
          `Trade ${trade.id} (${trade.symbol}): ${result.trigger} trigger detected at ${result.price}`,
        );

        await this.eventBus.publish(
          new TriggerDetectedEvent(
            trade,
            result.trigger,
            result.price,
            result.rr,
            result.tpIndex,
            result.lastTpIndex,
          ),
        );
        this.logger.info(`[Recovery] Published TriggerDetectedEvent for trade ${trade.id}`);
      }
    }

    this.logger.info(`Recovery complete. ${results.size} triggers detected.`);
    return results;
  }

  /**
   * Checks a pending trade for entry trigger using klines.
   */
  private async checkTradeForMissedTriggers(trade: Trade): Promise<TriggerResult> {
    // Check for inconsistent state first - has entryExecutedAt but status is not ACTIVE
    const statusStr = String(trade.status);
    if (trade.entryExecutedAt && (statusStr === 'pending' || statusStr === 'cancelled')) {
      this.logger.info(`[Recovery] Trade ${trade.id} has entryExecutedAt but status is ${statusStr}, fixing...`);
      return {
        triggered: true,
        trigger: TriggerType.ENTRY,
        price: trade.entryExecutedPrice || trade.entry,
      };
    }

    if (trade.status !== 'pending') {
      return { triggered: false };
    }

    if (trade.orderType !== OrderType.LIMIT) {
      return { triggered: false };
    }

    if (trade.entryExecutedAt) {
      this.logger.info(`[Recovery] Trade ${trade.id} has entryExecutedAt but status is PENDING, fixing...`);
      return {
        triggered: true,
        trigger: TriggerType.ENTRY,
        price: trade.entryExecutedPrice || trade.entry,
      };
    }

    const marketType = trade.side === TradeSide.SPOT ? 'spot' : 'futures';
    const startTime = trade.lastSeenTimestamp
      ? trade.lastSeenTimestamp.getTime()
      : trade.createdAt.getTime();
    const now = Date.now();
    const endTime = now;

    this.logger.debug(`[Recovery] Checking ${trade.symbol} from ${new Date(startTime).toISOString()}`);

    try {
      const klines = await this.priceStream.getKlines(
        trade.symbol,
        marketType as StreamMarketType,
        '1m',
        startTime,
        endTime,
        1440
      );

      if (!klines || klines.length === 0) {
        this.logger.warn(`No klines data for ${trade.symbol}`);
        return { triggered: false };
      }

      this.logger.debug(`[Recovery] Got ${klines.length} klines for ${trade.symbol}`);
      this.logger.info(`[Recovery] First candle: low=${klines[0]?.low}, high=${klines[0]?.high}, last candle: low=${klines[klines.length-1]?.low}, high=${klines[klines.length-1]?.high}`);

      return this.checkKlinesForEntryHit(trade, klines);
    } catch (error) {
      this.logger.error(`Failed to get klines for ${trade.symbol}: ${error}`);
      return { triggered: false };
    }
  }

  /**
   * Checks an active trade for TP/SL triggers using klines.
   */
  private async checkActiveTradeForMissedTriggers(trade: Trade): Promise<TriggerResult> {
    if (trade.status !== 'active' && trade.status !== 'partial_tp') {
      return { triggered: false };
    }

    if (!trade.entryExecutedAt) {
      return { triggered: false };
    }

    const marketType = trade.side === TradeSide.SPOT ? 'spot' : 'futures';
    const startTime = trade.lastSeenTimestamp
      ? trade.lastSeenTimestamp.getTime()
      : trade.createdAt.getTime();
    const now = Date.now();
    const endTime = now;

    try {
      const klines = await this.priceStream.getKlines(
        trade.symbol,
        marketType as StreamMarketType,
        '1m',
        startTime,
        endTime,
        1440
      );

      if (!klines || klines.length === 0) {
        return { triggered: false };
      }

      return this.checkKlinesForTPAndSLHit(trade, klines);
    } catch (error) {
      this.logger.error(`Failed to get klines for ${trade.symbol}: ${error}`);
      return { triggered: false };
    }
  }

  /**
   * Checks klines data for entry hit.
   */
  private checkKlinesForEntryHit(trade: Trade, klines: Kline[]): TriggerResult {
    const entry = trade.entry;

    for (const candle of klines) {
      if (trade.side === TradeSide.LONG || trade.side === TradeSide.SPOT) {
        if (candle.low <= entry) {
          this.logger.info(
            `[Recovery] LONG/SPOT ${trade.symbol}: Entry hit at ${entry} (candle low: ${candle.low})`
          );
          return {
            triggered: true,
            trigger: TriggerType.ENTRY,
            price: entry,
          };
        }
      } else if (trade.side === TradeSide.SHORT) {
        if (candle.high >= entry) {
          this.logger.info(
            `[Recovery] SHORT ${trade.symbol}: Entry hit at ${entry} (candle high: ${candle.high})`
          );
          return {
            triggered: true,
            trigger: TriggerType.ENTRY,
            price: entry,
          };
        }
      }
    }

    return { triggered: false };
  }

  /**
   * Checks klines data for TP and SL hits.
   */
  private checkKlinesForTPAndSLHit(trade: Trade, klines: Kline[]): TriggerResult {
    const isLongOrSpot = trade.side === TradeSide.LONG || trade.side === TradeSide.SPOT;

    for (let i = 0; i < klines.length; i++) {
      const candle = klines[i];

      if (trade.tps && trade.tps.length > 0) {
        for (let tpIndex = 0; tpIndex < trade.tps.length; tpIndex++) {
          const tp = trade.tps[tpIndex];
          if (trade.tpsHit?.includes(tpIndex)) continue;

          const isTpHit = isLongOrSpot
            ? candle.high >= tp
            : candle.low <= tp;

          if (isTpHit) {
            this.logger.info(`[Recovery] ${trade.symbol}: TP${tpIndex + 1} hit at ${tp}`);
            return {
              triggered: true,
              trigger: TriggerType.TP,
              price: tp,
              tpIndex,
            };
          }
        }
      }

      if (trade.sl) {
        const isSlHit = isLongOrSpot
          ? candle.low <= trade.sl
          : candle.high >= trade.sl;

        if (isSlHit) {
          this.logger.info(`[Recovery] ${trade.symbol}: SL hit at ${trade.sl}`);
          return {
            triggered: true,
            trigger: TriggerType.SL,
            price: trade.sl,
            rr: -1,
          };
        }
      }
    }

    return { triggered: false };
  }
}