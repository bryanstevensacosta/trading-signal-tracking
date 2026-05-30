import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject, forwardRef } from '@nestjs/common';
import { StateChangedEvent } from '@trade/state/domain/events';
import { TradeAlertService } from '@telegram/notification/trade-alerts/domain/services/trade-alert.service';
import { TELEGRAM_PORT, TelegramPort } from '@telegram/core/domain/ports/telegram.port';
import { getTelegramConfig } from '@config/telegram.config';
import { LOGGER_PORT, LoggerPort } from '../../../../../shared/domain/ports/logger.port';
import { CommandBus } from '@nestjs/cqrs';
import { RefreshTradeListCommand } from '@telegram/notification/trade-list/application/commands/refresh-trade-list/command';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '@trade/repository/domain/ports/trade-repository.port';

@EventsHandler(StateChangedEvent)
export class OnStateChangedHandler implements IEventHandler<StateChangedEvent> {
  private readonly logger: LoggerPort;

  constructor(
    private readonly templates: TradeAlertService,
    @Inject(TELEGRAM_PORT) private readonly telegram: TelegramPort,
    @Inject(forwardRef(() => TRADE_REPOSITORY_PORT))
    private readonly repository: TradeRepositoryPort,
    private readonly commandBus: CommandBus,
    @Inject(LOGGER_PORT) logger: LoggerPort,
  ) {
    this.logger = logger;
  }

  async handle(event: StateChangedEvent): Promise<void> {
    const { trade, newStatus, reason } = event;

    this.logger.info(`[OnStateChangedHandler] Handling: tradeId=${trade.id}, newStatus=${newStatus}, reason=${reason}`);

    const telegramConfig = getTelegramConfig();
    const isClosed = newStatus.startsWith('closed_') || newStatus === 'cancelled';

    if (reason === 'sl_triggered') {
      const message = this.templates.formatSLTriggered(trade);
      const currentTrade = await this.repository.findById(trade.id);
      const replyToMessageId = currentTrade?.notificationMessageId ?? undefined;

      this.logger.info(`[OnStateChangedHandler] Sending SL triggered message with replyToMessageId=${replyToMessageId}`);
      await this.telegram.sendMessage(
        telegramConfig.groupId,
        message,
        undefined,
        telegramConfig.singleTradeThreadId,
        replyToMessageId,
      );

      if (isClosed) {
        this.logger.info(`[OnStateChangedHandler] Refreshing trade list after SL triggered`);
        await this.commandBus.execute(new RefreshTradeListCommand(telegramConfig.groupId));
      }
      return;
    }

    if (reason === 'sl_after_tp') {
      this.logger.info(`[OnStateChangedHandler] SL after TP - no single-trade notification, just refreshing trade list`);
      if (isClosed) {
        await this.commandBus.execute(new RefreshTradeListCommand(telegramConfig.groupId));
      }
      return;
    }

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

    if (isClosed) {
      this.logger.info(`[OnStateChangedHandler] Refreshing trade list after ${reason}`);
      await this.commandBus.execute(new RefreshTradeListCommand(telegramConfig.groupId));
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