import { Injectable, Inject } from '@nestjs/common';
import { TradeListNotifierPort, TRADE_LIST_NOTIFIER_PORT } from '../../domain/ports/trade-list-notifier.port';
import { LOGGER_PORT, LoggerPort } from '../../../../../shared/domain/ports/logger.port';

interface PendingNotification {
  chatId: number;
  queuedAt: Date;
  timer: NodeJS.Timeout | null;
}

@Injectable()
export class NotificationBatcherService {
  private readonly logger: LoggerPort;
  private readonly pendingNotifications: Map<number, PendingNotification> = new Map();
  private readonly batchWindowMs = 60_000;

  constructor(
    @Inject(TRADE_LIST_NOTIFIER_PORT)
    private readonly notifier: TradeListNotifierPort,
    @Inject(LOGGER_PORT) logger: LoggerPort,
  ) {
    this.logger = logger;
  }

  enqueueNotification(chatId: number): void {
    const existing = this.pendingNotifications.get(chatId);

    if (existing) {
      this.logger.debug(`Batching notification for chat ${chatId}, queued at ${existing.queuedAt}`);
      return;
    }

    this.logger.debug(`First notification for chat ${chatId}, sending immediately and starting batch timer`);

    const pending: PendingNotification = {
      chatId,
      queuedAt: new Date(),
      timer: null,
    };

    this.pendingNotifications.set(chatId, pending);

    pending.timer = setTimeout(() => {
      this.flushBatch(chatId);
    }, this.batchWindowMs);
  }

  private async flushBatch(chatId: number): Promise<void> {
    const pending = this.pendingNotifications.get(chatId);
    if (!pending) return;

    if (pending.timer) {
      clearTimeout(pending.timer);
    }

    this.pendingNotifications.delete(chatId);

    this.logger.info(`Flushing batch for chat ${chatId}, sending consolidated notification`);

    try {
      await this.notifier.notify(chatId);
    } catch (error) {
      this.logger.error(`Failed to send batched notification to chat ${chatId}:`, error);
    }
  }

  hasPendingBatch(chatId: number): boolean {
    return this.pendingNotifications.has(chatId);
  }

  getPendingCount(): number {
    return this.pendingNotifications.size;
  }
}
