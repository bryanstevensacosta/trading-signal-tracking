import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { StateChangedEvent } from '@trade/state/domain/events';
import { NotificationTemplateService } from '@telegram/notification/single-trade/domain/services/notification-template.service';
import { TelegramPort, TELEGRAM_PORT } from '@telegram/notification/single-trade/domain/ports/telegram.port';
import { getTelegramConfig } from '@config/telegram.config';
import { LOGGER_PORT, LoggerPort } from '../../../../../shared/domain/ports/logger.port';

@EventsHandler(StateChangedEvent)
export class OnStateChangedHandler implements IEventHandler<StateChangedEvent> {
  private readonly logger: LoggerPort;

  constructor(
    private readonly templates: NotificationTemplateService,
    @Inject(TELEGRAM_PORT) private readonly telegram: TelegramPort,
    @Inject(LOGGER_PORT) logger: LoggerPort,
  ) {
    this.logger = logger;
  }

  async handle(event: StateChangedEvent): Promise<void> {
    const { trade, newStatus, reason } = event;

    this.logger.info(`[OnStateChangedHandler] Handling: tradeId=${trade.id}, newStatus=${newStatus}, reason=${reason}`);

    let message: string;

    switch (newStatus) {
      case 'active':
        return;
      case 'breakeven':
        message = this.templates.formatBreakeven(trade);
        break;
      case 'closed_win':
      case 'closed_partial':
      case 'closed_loss':
      case 'closed_breakeven':
      case 'closed_manual':
      case 'cancelled':
        message = this.templates.formatTradeClosed(trade, reason);
        break;
      default:
        return;
    }

    const telegramConfig = getTelegramConfig();
    this.logger.info(`[OnStateChangedHandler] Config: groupId=${telegramConfig.groupId}, threadId=${telegramConfig.singleTradeThreadId}`);

    const chatId = trade.sourceChat || this.getDefaultChatId();
    this.logger.info(`[OnStateChangedHandler] Sending message to private chat ${chatId}: ${message}`);
    this.logger.info(`[OnStateChangedHandler] Formatted message: ${JSON.stringify(message)}`);
    await this.telegram.sendMessage(chatId, message);

    this.logger.info(`[OnStateChangedHandler] Sending to group ${telegramConfig.groupId} with threadId=${telegramConfig.singleTradeThreadId}`);
    await this.telegram.sendMessage(
      telegramConfig.groupId,
      message,
      undefined,
      telegramConfig.singleTradeThreadId,
    );
  }

  private getDefaultChatId(): number {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!chatId) {
      throw new Error('TELEGRAM_CHAT_ID not configured');
    }
    return parseInt(chatId, 10);
  }
}