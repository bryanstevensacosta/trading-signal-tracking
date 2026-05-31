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
import { TELEGRAM_NOTIFICATION_LOG_PORT, TelegramNotificationLogPort } from '../../../shared/domain/ports/telegram-notification-log.port';
import { NotificationType, NotificationChannel } from '../../../shared/domain/entities/telegram-notification-log.entity';

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
    @Inject(TELEGRAM_NOTIFICATION_LOG_PORT) private readonly notificationLog: TelegramNotificationLogPort,
  ) {
    this.logger = logger;
  }

  async handle(event: StateChangedEvent): Promise<void> {
    const { trade, newStatus, reason } = event;

    this.logger.info(`[OnStateChangedHandler] Handling: tradeId=${trade.id}, newStatus=${newStatus}, reason=${reason}`);

    const telegramConfig = getTelegramConfig();
    const isClosed = newStatus.startsWith('closed_') || newStatus === 'cancelled';

    if (reason === 'sl_triggered') {
      const alreadySent = await this.notificationLog.wasSent(trade.id, NotificationType.SL, NotificationChannel.ALERTS);
      if (alreadySent) {
        this.logger.info(`[OnStateChangedHandler] SL notification already sent for trade ${trade.id}, skipping`);
        return;
      }

      const message = this.templates.formatSLTriggered(trade);
      const currentTrade = await this.repository.findById(trade.id);
      const replyToMessageId = currentTrade?.tradeAlertsMessageId ?? undefined;

      this.logger.info(`[OnStateChangedHandler] Sending SL triggered message with replyToMessageId=${replyToMessageId}`);
      const sentMessageId = await this.telegram.sendMessage(
        telegramConfig.groupId,
        message,
        undefined,
        telegramConfig.tradeAlertsThreadId,
        replyToMessageId,
      );

      if (sentMessageId) {
        await this.repository.update(trade.id, { tradeAlertsMessageId: sentMessageId });
        await this.notificationLog.logSent({
          tradeId: trade.id,
          type: NotificationType.SL,
          channel: NotificationChannel.ALERTS,
          messageId: sentMessageId,
          chatId: telegramConfig.groupId.toString(),
        });
      }

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

    if (newStatus === 'active' && reason === 'entry_triggered') {
      const alreadySent = await this.notificationLog.wasSent(trade.id, NotificationType.ENTRY, NotificationChannel.ALERTS);
      if (alreadySent) {
        this.logger.info(`[OnStateChangedHandler] Entry notification already sent for trade ${trade.id}, skipping`);
        return;
      }

      const currentTrade = await this.repository.findById(trade.id);
      const replyToMessageId = currentTrade?.tradeAlertsMessageId ?? undefined;

      const message = this.templates.formatEntryHitInstant(trade, trade.entryExecutedPrice!);
      this.logger.info(`[OnStateChangedHandler] Entry executed - sending notification with replyToMessageId=${replyToMessageId}`);

      const sentMessageId = await this.telegram.sendMessage(
        telegramConfig.groupId,
        message,
        undefined,
        telegramConfig.tradeAlertsThreadId,
        replyToMessageId,
      );

      if (sentMessageId) {
        await this.repository.update(trade.id, { tradeAlertsMessageId: sentMessageId });
        await this.notificationLog.logSent({
          tradeId: trade.id,
          type: NotificationType.ENTRY,
          channel: NotificationChannel.ALERTS,
          messageId: sentMessageId,
          chatId: telegramConfig.groupId.toString(),
        });
        this.logger.info(`[OnStateChangedHandler] Updated tradeAlertsMessageId to ${sentMessageId} for trade ${trade.id}`);
      }

      this.logger.info(`[OnStateChangedHandler] Refreshing trade list after entry triggered`);
      await this.commandBus.execute(new RefreshTradeListCommand(telegramConfig.groupId));
      return;
    }

    let message: string;
    let notificationType: NotificationType;

    if (reason === 'all_tp_hit') {
      const tpIndex = trade.tpsHit && trade.tpsHit.length > 0
        ? trade.tpsHit[trade.tpsHit.length - 1]
        : trade.tps && trade.tps.length > 0
          ? trade.tps.length - 1
          : 0;

      message = this.templates.formatTPHit(trade, tpIndex, event.rr);
      const currentTrade = await this.repository.findById(trade.id);
      const replyToMessageId = currentTrade?.tradeAlertsMessageId ?? undefined;

      const alreadySent = await this.notificationLog.wasSent(trade.id, NotificationType.TP, NotificationChannel.ALERTS);
      if (alreadySent) {
        this.logger.info(`[OnStateChangedHandler] TP notification already sent for trade ${trade.id}, skipping`);
        return;
      }

      this.logger.info(`[OnStateChangedHandler] Sending TP hit notification with replyToMessageId=${replyToMessageId}`);
      const sentMessageId = await this.telegram.sendMessage(
        telegramConfig.groupId,
        message,
        undefined,
        telegramConfig.tradeAlertsThreadId,
        replyToMessageId,
      );

      if (sentMessageId) {
        await this.repository.update(trade.id, { tradeAlertsMessageId: sentMessageId });
        await this.notificationLog.logSent({
          tradeId: trade.id,
          type: NotificationType.TP,
          channel: NotificationChannel.ALERTS,
          messageId: sentMessageId,
          chatId: telegramConfig.groupId.toString(),
        });
      }

      this.logger.info(`[OnStateChangedHandler] Refreshing trade list after all_tp_hit`);
      await this.commandBus.execute(new RefreshTradeListCommand(telegramConfig.groupId));
      return;
    }

    switch (newStatus) {
      case 'active':
        return;
      case 'breakeven':
        notificationType = NotificationType.BREAKEVEN;
        message = this.templates.formatBreakeven(trade);
        break;
      case 'closed_win':
      case 'closed_partial':
      case 'closed_loss':
      case 'closed_breakeven':
      case 'closed_manual':
      case 'cancelled':
        notificationType = NotificationType.CLOSED_WIN;
        message = this.templates.formatTradeClosed(trade, reason);
        break;
      default:
        return;
    }

    const alreadySent = await this.notificationLog.wasSent(trade.id, notificationType, NotificationChannel.ALERTS);
    if (alreadySent) {
      this.logger.info(`[OnStateChangedHandler] ${notificationType} notification already sent for trade ${trade.id}, skipping`);
      return;
    }

    this.logger.info(`[OnStateChangedHandler] Config: groupId=${telegramConfig.groupId}, threadId=${telegramConfig.tradeAlertsThreadId}`);

    const chatId = trade.sourceChat || this.getDefaultChatId();
    this.logger.info(`[OnStateChangedHandler] Sending message to private chat ${chatId}: ${message}`);
    this.logger.info(`[OnStateChangedHandler] Formatted message: ${JSON.stringify(message)}`);
    await this.telegram.sendMessage(chatId, message);

    this.logger.info(`[OnStateChangedHandler] Sending to group ${telegramConfig.groupId} with threadId=${telegramConfig.tradeAlertsThreadId}`);
    const sentMessageId = await this.telegram.sendMessage(
      telegramConfig.groupId,
      message,
      undefined,
      telegramConfig.tradeAlertsThreadId,
    );

    if (sentMessageId) {
      await this.repository.update(trade.id, { tradeAlertsMessageId: sentMessageId });
      await this.notificationLog.logSent({
        tradeId: trade.id,
        type: notificationType,
        channel: NotificationChannel.ALERTS,
        messageId: sentMessageId,
        chatId: telegramConfig.groupId.toString(),
      });
    }

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