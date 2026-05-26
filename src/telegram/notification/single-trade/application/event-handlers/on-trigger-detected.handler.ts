import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TriggerDetectedEvent } from '@trade/engine/domain/events';
import { NotificationTemplateService } from '@telegram/notification/single-trade/domain/services/notification-template.service';
import { TelegramPort, TELEGRAM_PORT } from '@telegram/notification/single-trade/domain/ports/telegram.port';
import { getTelegramConfig } from '@config/telegram.config';
import { LOGGER_PORT, LoggerPort } from '../../../../../shared/domain/ports/logger.port';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '@trade/repository/domain/ports/trade-repository.port';

@EventsHandler(TriggerDetectedEvent)
export class OnTriggerNotificationHandler implements IEventHandler<TriggerDetectedEvent> {
  private readonly logger: LoggerPort;

  constructor(
    private readonly templates: NotificationTemplateService,
    @Inject(TELEGRAM_PORT) private readonly telegram: TelegramPort,
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    @Inject(LOGGER_PORT) logger: LoggerPort,
  ) {
    this.logger = logger;
  }

  async handle(event: TriggerDetectedEvent): Promise<void> {
    const { trade, trigger, rr, tpIndex, price } = event;

    console.log(`[OnTriggerNotificationHandler] RECEIVED: tradeId=${trade.id}, trigger=${trigger}, price=${price}, rr=${rr}, tpIndex=${tpIndex}`);
    this.logger.info(`[OnTriggerNotificationHandler] Handling: tradeId=${trade.id}, trigger=${trigger}, price=${price}, rr=${rr}, tpIndex=${tpIndex}`);

    let message: string;

    switch (trigger) {
      case 'entry':
        message = this.templates.formatEntryTriggered(trade, price);
        break;
      case 'tp':
        message = this.templates.formatTPHit(trade, tpIndex!, rr!);
        break;
      case 'sl':
        message = this.templates.formatSLHit(trade, rr!);
        break;
      case 'breakeven':
        message = this.templates.formatBreakeven(trade);
        break;
default:
        this.logger.warn(`[OnTriggerNotificationHandler] Unknown trigger: ${trigger}`);
        return;
    }

    const chatId = trade.sourceChat || this.getDefaultChatId();
    const telegramConfig = getTelegramConfig();

    const currentTrade = await this.repository.findById(trade.id);
    const replyToMessageId = currentTrade?.notificationMessageId ?? undefined;

    this.logger.info(`[OnTriggerNotificationHandler] Formatted message: ${JSON.stringify(message)}`);
    const sentMessageId = await this.telegram.sendMessage(chatId, message, undefined, telegramConfig.singleTradeThreadId, replyToMessageId);

    if (sentMessageId && sentMessageId > 0) {
      await this.repository.update(trade.id, { notificationMessageId: sentMessageId });
    }
  }

  private getDefaultChatId(): number {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!chatId) {
      throw new Error('TELEGRAM_CHAT_ID not configured');
    }
    return parseInt(chatId, 10);
  }
}