import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, forwardRef } from '@nestjs/common';
import { LoggerPort, LOGGER_PORT } from '@shared/domain/ports/logger.port';
import { CommandBus } from '@nestjs/cqrs';
import { ApproveTradeCommand } from './command';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '@trade/repository/domain/ports/trade-repository.port';
import { TELEGRAM_PORT, TelegramPort } from '@telegram/core/domain/ports/telegram.port';
import { TradeApprovalService } from '../../../domain/services/confirmation-template.service';
import { TradeAlertService } from '@telegram/notification/trade-alerts/domain/services/trade-alert.service';
import { StartMonitoringCommand } from '@trade/trigger/application/commands/start-monitoring/command';
import { Trade, TradeStatus, TradeSide } from '@trade/shared';
import { TelegramConfig } from '@config/telegram.config';
import { getTelegramConfig } from '@config/telegram.config';
import { TradeListService } from '@telegram/notification/trade-list/domain/services/trade-list.service';
import { PRICE_CACHE_PORT, PriceCachePort } from '@price/cache/domain/ports/price-cache.port';
import { TELEGRAM_NOTIFICATION_LOG_PORT, TelegramNotificationLogPort } from '../../../../shared/domain/ports/telegram-notification-log.port';
import { NotificationType, NotificationChannel } from '../../../../shared/domain/entities/telegram-notification-log.entity';
import { TriggerDetectorService } from '@trade/trigger/domain/services/trigger-detector.service';
import { SPOT_PORT, FUTURES_PORT } from '@price/provider/binance/tokens';
import type { BinanceSpotPort } from '@price/provider/binance/domain/ports/binance-spot.port';
import type { BinanceFuturesPort } from '@price/provider/binance/domain/ports/binance-futures.port';

@CommandHandler(ApproveTradeCommand)
export class ApproveTradeHandler implements ICommandHandler<ApproveTradeCommand> {
  private readonly logger: LoggerPort;

  constructor(
    @Inject(LOGGER_PORT) logger: LoggerPort,
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    private readonly commandBus: CommandBus,
    @Inject(TELEGRAM_PORT) private readonly telegram: TelegramPort,
    private readonly templates: TradeApprovalService,
    private readonly notificationTemplates: TradeAlertService,
    @Inject(forwardRef(() => TradeListService)) private readonly displayService: TradeListService,
    @Inject(forwardRef(() => PRICE_CACHE_PORT)) private readonly priceCache: PriceCachePort,
    @Inject(TELEGRAM_NOTIFICATION_LOG_PORT) private readonly notificationLog: TelegramNotificationLogPort,
    private readonly triggerDetector: TriggerDetectorService,
    @Inject(SPOT_PORT) private readonly spotExchange: BinanceSpotPort,
    @Inject(FUTURES_PORT) private readonly futuresExchange: BinanceFuturesPort,
  ) {
    this.logger = logger;
  }

  async execute(command: ApproveTradeCommand): Promise<void> {
    const startTime = Date.now();
    const telegramConfig = getTelegramConfig();
    this.logger.info(`[PERF] ApproveTrade START: tradeId=${command.tradeId} timestamp=${startTime}`);
    this.logger.debug(`Config: groupId=${telegramConfig.groupId}, tradeAlertsThreadId=${telegramConfig.tradeAlertsThreadId}, tradeListThreadId=${telegramConfig.tradeListThreadId}`);
    this.logger.debug(`Command: chatId=${command.chatId}`);

    const trade = await this.repository.findById(command.tradeId);
    if (!trade) {
      this.logger.error(`Trade ${command.tradeId} not found`);
      await this.telegram.sendMessage(command.chatId, `❌ Trade not found. It may have been cancelled.`, undefined, telegramConfig.tradeAlertsThreadId);
      return;
    }

    if (trade.status !== TradeStatus.PENDING) {
      this.logger.warn(`Trade ${command.tradeId} is not in PENDING status (current: ${trade.status})`);
    }

    if (command.messageId) {
      await this.handleEditConfirmationMessage(command, trade, telegramConfig);
      return;
    }

    const currentPrice = await this.getCurrentPrice(trade.symbol, trade.side);

    const isInstantActive = currentPrice && this.triggerDetector.isEntryAlreadyHit(trade, currentPrice);
    const executedPrice = isInstantActive ? this.triggerDetector.getExecutedEntryPrice(trade, currentPrice) : null;

    this.logger.info(`[ApproveTrade] Symbol=${trade.symbol}, currentPrice=${currentPrice}, isInstantActive=${isInstantActive}, executedPrice=${executedPrice}`);

    if (isInstantActive && executedPrice) {
      await this.handleInstantActive(command, trade, executedPrice, telegramConfig);
      return;
    }

    await this.handleNormalFlow(command, trade, telegramConfig);
  }

  private async handleEditConfirmationMessage(
    command: ApproveTradeCommand,
    trade: Trade,
    telegramConfig: TelegramConfig,
  ): Promise<void> {
    if (!command.messageId) {
      this.logger.warn(`[ApproveTrade] No messageId provided for trade ${trade.id}, using normal flow`);
      await this.handleNormalFlow(command, trade, telegramConfig);
      return;
    }

    this.logger.info(`[ApproveTrade] Editing confirmation message for trade ${trade.id}`);

    const confirmedText = this.templates.formatTradeApproved(trade);

    await this.telegram.editMessage(
      command.chatId,
      command.messageId,
      confirmedText,
    );

    await this.repository.update(command.tradeId, { approvedAt: new Date() });
    await this.commandBus.execute(new StartMonitoringCommand(trade.id));

    const newTradeMessage = this.notificationTemplates.formatTradeCreated(trade);
    this.logger.debug(`Sending NEW TRADE to group ${telegramConfig.groupId} with threadId=${telegramConfig.tradeAlertsThreadId}:\n${newTradeMessage}`);
    const newTradeMessageId = await this.telegram.sendMessage(telegramConfig.groupId, newTradeMessage, { parse_mode: 'HTML' }, telegramConfig.tradeAlertsThreadId);
    if (newTradeMessageId && newTradeMessageId > 0) {
      await this.repository.update(command.tradeId, { tradeAlertsMessageId: newTradeMessageId });
      await this.notificationLog.logSent({
        tradeId: trade.id,
        type: NotificationType.APPROVED,
        channel: NotificationChannel.ALERTS,
        messageId: newTradeMessageId,
        chatId: telegramConfig.groupId?.toString(),
      });
    }

    await this.sendTradeListUpdate(telegramConfig);
  }

  private async getCurrentPrice(symbol: string, side: TradeSide): Promise<number | null> {
    try {
      const exchange = side === TradeSide.SPOT ? this.spotExchange : this.futuresExchange;
      const ticker = await exchange.getTicker(symbol);
      this.logger.info(`[ApproveTrade] Fetched price from Binance: ${symbol} = ${ticker.last}`);
      return ticker.last;
    } catch (error) {
      this.logger.error(`[ApproveTrade] Failed to fetch price from Binance for ${symbol}:`, error);
      return null;
    }
  }

  private async handleInstantActive(
    command: ApproveTradeCommand,
    trade: Trade,
    executedPrice: number,
    telegramConfig: TelegramConfig,
  ): Promise<void> {
    this.logger.info(`[ApproveTrade] Handling INSTANT ACTIVE for trade ${trade.id}`);

    const precision = this.futuresExchange.getSymbolPrecision(trade.symbol);
    const roundedPrice = Math.round(executedPrice * Math.pow(10, precision)) / Math.pow(10, precision);

    await this.repository.update(trade.id, {
      approvedAt: new Date(),
      entryExecutedPrice: roundedPrice,
      entryExecutedAt: new Date(),
      status: TradeStatus.ACTIVE,
    });

    await this.commandBus.execute(new StartMonitoringCommand(trade.id));

    await this.telegram.sendMessage(command.chatId, this.templates.formatTradeApproved(trade), undefined, telegramConfig.tradeAlertsThreadId);

    const newTradeMessage = this.notificationTemplates.formatTradeCreatedInstantActive(trade, executedPrice);
    this.logger.debug(`Sending INSTANT ACTIVE NEW TRADE to group:\n${newTradeMessage}`);
    const newTradeMessageId = await this.telegram.sendMessage(telegramConfig.groupId, newTradeMessage, { parse_mode: 'HTML' }, telegramConfig.tradeAlertsThreadId);

    if (newTradeMessageId && newTradeMessageId > 0) {
      await this.repository.update(command.tradeId, { tradeAlertsMessageId: newTradeMessageId });
      await this.notificationLog.logSent({
        tradeId: trade.id,
        type: NotificationType.APPROVED,
        channel: NotificationChannel.ALERTS,
        messageId: newTradeMessageId,
        chatId: telegramConfig.groupId?.toString(),
      });

      const entryAlreadySent = await this.notificationLog.wasSent(
        trade.id,
        NotificationType.ENTRY,
        NotificationChannel.ALERTS,
      );

      if (entryAlreadySent) {
        this.logger.info(`[ApproveTrade] ENTRY already sent for trade ${trade.id} (via OnStateChangedHandler), skipping duplicate ENTRY HIT`);
      } else {
        const entryHitMessage = this.notificationTemplates.formatEntryHitInstant(trade, executedPrice);
        this.logger.debug(`Sending ENTRY HIT as reply to ${newTradeMessageId}:\n${entryHitMessage}`);
        await new Promise(resolve => setTimeout(resolve, 150));
        const entryHitMessageId = await this.telegram.sendMessage(
          telegramConfig.groupId,
          entryHitMessage,
          { parse_mode: 'HTML' },
          telegramConfig.tradeAlertsThreadId,
          newTradeMessageId,
        );

        if (entryHitMessageId && entryHitMessageId > 0) {
          await this.repository.update(command.tradeId, { tradeAlertsMessageId: entryHitMessageId });
          await this.notificationLog.logSent({
            tradeId: trade.id,
            type: NotificationType.ENTRY,
            channel: NotificationChannel.ALERTS,
            messageId: entryHitMessageId,
            chatId: telegramConfig.groupId?.toString(),
          });
        }
      }
    }

    await this.sendTradeListUpdate(telegramConfig);
  }

  private async handleNormalFlow(
    command: ApproveTradeCommand,
    trade: Trade,
    telegramConfig: TelegramConfig,
  ): Promise<void> {
    this.logger.info(`[ApproveTrade] Handling NORMAL FLOW for trade ${trade.id}`);

    const startMonitoringStart = Date.now();
    await this.commandBus.execute(new StartMonitoringCommand(trade.id));
    const startMonitoringEnd = Date.now();
    this.logger.info(`[PERF] StartMonitoring EXECUTED: tradeId=${command.tradeId} duration=${startMonitoringEnd - startMonitoringStart}ms`);

    await this.repository.update(command.tradeId, { approvedAt: new Date() });
    this.logger.info(`Trade ${command.tradeId} marked as approved at ${new Date().toISOString()}`);

    await this.telegram.sendMessage(command.chatId, this.templates.formatTradeApproved(trade), undefined, telegramConfig.tradeAlertsThreadId);

    const newTradeMessage = this.notificationTemplates.formatTradeCreated(trade);
    this.logger.debug(`Sending NEW TRADE to group ${telegramConfig.groupId} with threadId=${telegramConfig.tradeAlertsThreadId}:\n${newTradeMessage}`);
    const newTradeMessageId = await this.telegram.sendMessage(telegramConfig.groupId, newTradeMessage, { parse_mode: 'HTML' }, telegramConfig.tradeAlertsThreadId);
    if (newTradeMessageId && newTradeMessageId > 0) {
      await this.repository.update(command.tradeId, { tradeAlertsMessageId: newTradeMessageId });
      await this.notificationLog.logSent({
        tradeId: trade.id,
        type: NotificationType.APPROVED,
        channel: NotificationChannel.ALERTS,
        messageId: newTradeMessageId,
        chatId: telegramConfig.groupId?.toString(),
      });
    }

    await this.sendTradeListUpdate(telegramConfig);
  }

  private async sendTradeListUpdate(telegramConfig: TelegramConfig): Promise<void> {
    const allTrades = await this.repository.findAll();
    const symbols = [...new Set(allTrades.map((t: Trade) => t.symbol))];
    const prices = this.priceCache.getBySymbols(symbols);
    const result = this.displayService.formatTradeList(allTrades, prices, 1, 100);
    const tradeListMessage = result.trades.join('\n\n');
    this.logger.debug(`Message for group (trade list):\n${tradeListMessage}`);
    this.logger.debug(`Sending to group ${telegramConfig.groupId} with threadId=${telegramConfig.tradeListThreadId}`);
    await this.telegram.sendMessage(telegramConfig.groupId, tradeListMessage, { parse_mode: 'HTML' }, telegramConfig.tradeListThreadId);
  }
}