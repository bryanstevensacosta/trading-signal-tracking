import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TradeSavedEvent } from '../../domain/events/trade-saved.event';
import { NotificationTemplateService } from '@telegram/notification/single-trade/domain/services/notification-template.service';
import { TELEGRAM_PORT } from '@telegram/notification/single-trade/domain/ports/telegram.port';
import { TradingEngineService } from '../../../engine/domain/services/trading-engine.service';
import { getTelegramConfig } from '@config/telegram.config';
import { LoggerPort, LOGGER_PORT } from '../../../../shared/domain/ports/logger.port';

/**
 * Handles notifications after a trade is saved from Telegram ingestion.
 */
@EventsHandler(TradeSavedEvent)
export class OnTradeSavedHandler implements IEventHandler<TradeSavedEvent> {
  private readonly logger: LoggerPort;

  constructor(
    private readonly templates: NotificationTemplateService,
    @Inject(TELEGRAM_PORT) private readonly telegram: any,
    private readonly engine: TradingEngineService,
    @Inject(LOGGER_PORT) logger: LoggerPort,
  ) {
    this.logger = logger;
  }

  async handle(event: TradeSavedEvent): Promise<void> {
    const { trade, sourceChatId } = event;

    await this.engine.startMonitoring(trade);
    this.logger.info(`Started monitoring trade ${trade.id} for ${trade.symbol}`);

    const message = this.templates.formatTradeCreated(trade);
    this.logger.debug(`Sending trade creation notification to chat ${sourceChatId}`);

    try {
      await this.telegram.sendMessage(sourceChatId, message);
      this.logger.info(`Notification sent for trade ${trade.id}`);

      const telegramConfig = getTelegramConfig();
      await this.telegram.sendMessage(
        telegramConfig.groupId,
        message,
        undefined,
        telegramConfig.singleTradeThreadId,
      );
      this.logger.debug(`Group notification sent for trade ${trade.id}`);
    } catch (error) {
      this.logger.error(`Failed to send notification for trade ${trade.id}:`, error);
    }
  }
}