import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { Trade, OrderType, TradeSide, TriggerType } from '@trade/shared';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '../../repository/domain/ports/trade-repository.port';
import { PriceStreamService, MarketType as StreamMarketType } from '@price/stream/domain/services/price-stream.service';
import { TriggerDetectorService, TriggerResult } from '../domain/services/trigger-detector.service';
import { LoggerPort, LOGGER_PORT } from '../../../shared/domain/ports/logger.port';

/**
 * Service responsible for recovering missed triggers on application startup.
 * Uses historical klines to check if price touched entry while server was down.
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
   * Recovers missed entry triggers for all pending LIMIT orders.
   * Uses klines historical data to check if price touched entry while server was down.
   * Called on application startup to check for triggers that should have fired.
   */
  async recoverMissedTriggers(): Promise<Map<string, TriggerResult>> {
    const results = new Map<string, TriggerResult>();

    const pendingTrades = await this.tradeRepository.findPending();

    this.logger.info(`Checking ${pendingTrades.length} pending trades for missed triggers`);

    for (const trade of pendingTrades) {
      if (trade.status !== 'pending') {
        continue;
      }

      const result = await this.checkTradeForMissedTriggers(trade);

      if (result.triggered) {
        results.set(trade.id, result);
        this.logger.info(
          `Trade ${trade.id} (${trade.symbol}): ${result.trigger} trigger detected at ${result.price}`,
        );
      }
    }

    this.logger.info(`Recovery complete. ${results.size} triggers detected.`);
    return results;
  }

  /**
   * Checks a single trade for any missed triggers using klines.
   */
  private async checkTradeForMissedTriggers(trade: Trade): Promise<TriggerResult> {
    if (trade.orderType !== OrderType.LIMIT) {
      return { triggered: false };
    }

    if (trade.entryExecutedAt) {
      return { triggered: false };
    }

    const marketType = trade.side === TradeSide.SPOT ? 'spot' : 'futures';
    // Use lastSeenTimestamp if available, otherwise use createdAt
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
        1440 // max 24 hours
      );

      if (!klines || klines.length === 0) {
        this.logger.warn(`No klines data for ${trade.symbol}`);
        return { triggered: false };
      }

      this.logger.debug(`[Recovery] Got ${klines.length} klines for ${trade.symbol}`);

      return this.checkKlinesForEntryHit(trade, klines);
    } catch (error) {
      this.logger.error(`Failed to get klines for ${trade.symbol}: ${error}`);
      return { triggered: false };
    }
  }

  /**
   * Checks klines data for entry hit.
   * LONG/SPOT: Activates if price went DOWN to entry (low <= entry)
   * SHORT: Activates if price went UP to entry (high >= entry)
   */
  private checkKlinesForEntryHit(trade: Trade, klines: Array<{
    openTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    closeTime: number;
  }>): TriggerResult {
    const entry = trade.entry;

    for (const candle of klines) {
      if (trade.side === TradeSide.LONG || trade.side === TradeSide.SPOT) {
        // LONG/SPOT: Entry se activa cuando el precio BAJA hasta la entrada
        // Verificamos si el low de la vela tocó o bajó de la entrada
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
        // SHORT: Entry se activa cuando el precio SUBE hasta la entrada
        // Verificamos si el high de la vela tocó o subió de la entrada
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
}