import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { StateChangedEvent } from '@trade/state/domain/events';
import { NotificationBatcherService } from '../../domain/services/notification-batcher.service';
import { Inject } from '@nestjs/common';
import { getTelegramConfig } from '@config/telegram.config';
import { LOGGER_PORT, LoggerPort } from '../../../../../shared/domain/ports/logger.port';

@EventsHandler(StateChangedEvent)
export class OnTradeListRefreshHandler
  implements IEventHandler<StateChangedEvent>
{
  private readonly logger: LoggerPort;

  constructor(
    private readonly batcher: NotificationBatcherService,
    @Inject(LOGGER_PORT) logger: LoggerPort,
  ) {
    this.logger = logger;
  }

  async handle(event: StateChangedEvent): Promise<void> {
    const telegramConfig = getTelegramConfig();
    const telegramChatId = parseInt(process.env.TELEGRAM_CHAT_ID || '0', 10);
    const chatId = event.trade.sourceChat || telegramChatId || telegramConfig.groupId;
    if (!chatId) {
      this.logger.debug(`Trade ${event.trade.id} state changed but no chat ID available, skipping notification`);
      return;
    }
    this.logger.debug(`Trade ${event.trade.id} state changed: ${event.oldStatus} -> ${event.newStatus}, queueing notification`);
    this.batcher.enqueueNotification(chatId);
  }
}