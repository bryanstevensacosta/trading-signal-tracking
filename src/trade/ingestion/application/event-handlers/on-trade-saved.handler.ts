import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TradeSavedEvent } from '../../domain/events/trade-saved.event';
import { TradeAlertService } from '@telegram/notification/trade-alerts/domain/services/trade-alert.service';
import { TELEGRAM_PORT, TelegramPort } from '@telegram/core';
import { TriggerOrchestratorService } from '../../../trigger/domain/services/trigger-orchestrator.service';
import { getTelegramConfig } from '@config/telegram.config';
import { LoggerPort, LOGGER_PORT } from '../../../../shared/domain/ports/logger.port';

/**
 * Handles notifications after a trade is saved from Telegram ingestion.
 */
@EventsHandler(TradeSavedEvent)
export class OnTradeSavedHandler implements IEventHandler<TradeSavedEvent> {
  private readonly logger: LoggerPort;

  constructor(
    private readonly templates: TradeAlertService,
    @Inject(TELEGRAM_PORT) private readonly telegram: TelegramPort,
    private readonly engine: TriggerOrchestratorService,
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
        telegramConfig.tradeAlertsThreadId,
      );
      this.logger.debug(`Group notification sent for trade ${trade.id}`);
    } catch (error) {
      this.logger.error(`Failed to send notification for trade ${trade.id}:`, error);
    }
  }
}