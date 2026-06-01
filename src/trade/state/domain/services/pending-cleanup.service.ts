import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { LOGGER_PORT, LoggerPort } from '@shared/domain/ports/logger.port';
import { TRADE_REPOSITORY_PORT, TradeRepositoryPort } from '@trade/repository/domain/ports/trade-repository.port';
import { TradeStatus, CancelledBy } from '@trade/shared/types';
import { PendingTradeExpiredEvent } from '../events/pending-trade-expired.event';

@Injectable()
export class PendingCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly PENDING_TIMEOUT_MS = 15 * 60 * 1000;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    private readonly eventBus: EventBus,
    @Inject(LOGGER_PORT) private readonly logger: LoggerPort,
  ) {}

  async onModuleInit(): Promise<void> {
    this.interval = setInterval(() => {
      this.cleanupPendingTrades().catch((error) => {
        this.logger.error(`Error cleaning up pending trades: ${error}`);
      });
    }, 60000);

    this.logger.info('PendingCleanupService initialized - checking pending trades every minute');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.logger.info('PendingCleanupService stopped');
  }

  private async cleanupPendingTrades(): Promise<void> {
    const pending = await this.repository.findPending();
    const now = Date.now();

    for (const trade of pending) {
      if (trade.approvedAt) {
        continue;
      }
      const elapsed = now - new Date(trade.createdAt).getTime();
      if (elapsed > this.PENDING_TIMEOUT_MS) {
        await this.cancelTradeWithNotification(
          trade.id,
          'Timeout: Trade cancelled after 15 minutes of inactivity',
          'auto_timeout',
        );
      }
    }
  }

  async cancelAllPending(reason: string = 'New trade received', cancelledBy: CancelledBy = 'auto_message'): Promise<number> {
    const pending = await this.repository.findPending();
    let cancelledCount = 0;

    for (const trade of pending) {
      const success = await this.cancelTradeWithNotification(trade.id, reason, cancelledBy);
      if (success) cancelledCount++;
    }

    return cancelledCount;
  }

  private async cancelTradeWithNotification(tradeId: string, reason: string, cancelledBy: CancelledBy): Promise<boolean> {
    const trade = await this.repository.findById(tradeId);
    if (!trade || trade.status !== TradeStatus.PENDING) {
      return false;
    }

    if (trade.approvedAt) {
      this.logger.info(`Trade ${tradeId} is approved (approvedAt: ${trade.approvedAt}), skipping cancellation`);
      return false;
    }

    await this.repository.update(tradeId, { status: TradeStatus.CANCELLED, cancelledBy });

    await this.eventBus.publish(
      new PendingTradeExpiredEvent(trade, reason, cancelledBy),
    );

    this.logger.info(`Trade ${tradeId} cancelled: ${reason}`);
    return true;
  }
}