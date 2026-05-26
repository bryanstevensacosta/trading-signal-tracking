import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { OrderType } from '@trade/shared';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '../../repository/domain/ports/trade-repository.port';
import { PriceStreamService } from '@price/stream/domain/services/price-stream.service';
import { TriggerDetectorService, TriggerResult } from '../domain/services/trigger-detector.service';
import { LoggerPort, LOGGER_PORT } from '../../../shared/domain/ports/logger.port';

/**
 * Service responsible for recovering missed triggers on application startup.
 * Checks if any LIMIT orders should have been filled while the application was down.
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
   * Checks a single trade for any missed triggers.
   */
  private async checkTradeForMissedTriggers(trade: any): Promise<TriggerResult> {
    if (trade.orderType !== OrderType.LIMIT) {
      return { triggered: false };
    }

    if (trade.entryExecutedAt) {
      return { triggered: false };
    }

    const price = await this.priceStream.getCurrentPrice(trade.symbol);

    if (!price) {
      this.logger.warn(`Could not get current price for ${trade.symbol}`);
      return { triggered: false };
    }

    return this.triggerDetector.checkEntryHit(trade, price);
  }
}