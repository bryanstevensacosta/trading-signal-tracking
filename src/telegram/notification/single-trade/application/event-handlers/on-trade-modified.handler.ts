import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TradeUpdatedEvent } from '@trade/shared/events';
import { NotificationTemplateService } from '@telegram/notification/single-trade/domain/services/notification-template.service';
import { TelegramPort, TELEGRAM_PORT } from '@telegram/notification/single-trade/domain/ports/telegram.port';
import { getTelegramConfig } from '@config/telegram.config';
import { LOGGER_PORT, LoggerPort } from '../../../../../shared/domain/ports/logger.port';

@EventsHandler(TradeUpdatedEvent)
export class OnTradeModifiedHandler implements IEventHandler<TradeUpdatedEvent> {
  private readonly logger: LoggerPort;

  constructor(
    private readonly templates: NotificationTemplateService,
    @Inject(TELEGRAM_PORT) private readonly telegram: TelegramPort,
    @Inject(LOGGER_PORT) logger: LoggerPort,
  ) {
    this.logger = logger;
  }

  async handle(event: TradeUpdatedEvent): Promise<void> {
    const { trade, field, oldValue, newValue } = event;

    this.logger.debug(`Handling TradeUpdatedEvent: tradeId=${trade.id}, field=${field}`);

    const message = this.templates.formatModification(trade, field, oldValue, newValue);

    const telegramConfig = getTelegramConfig();
    this.logger.debug(`Config: groupId=${telegramConfig.groupId}, singleTradeThreadId=${telegramConfig.singleTradeThreadId}`);

    const chatId = trade.sourceChat || this.getDefaultChatId();
    this.logger.debug(`Sending to private chat ${chatId}`);
    await this.telegram.sendMessage(chatId, message);

    this.logger.debug(`Sending to group ${telegramConfig.groupId} with threadId=${telegramConfig.singleTradeThreadId}`);
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