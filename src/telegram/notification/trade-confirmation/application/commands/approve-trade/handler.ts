import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { LoggerPort, LOGGER_PORT } from '@shared/domain/ports/logger.port';
import { CommandBus } from '@nestjs/cqrs';
import { ApproveTradeCommand } from './command';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '@trade/repository/domain/ports/trade-repository.port';
import { TELEGRAM_PORT } from '@telegram/notification/single-trade/domain/ports/telegram.port';
import { ConfirmationTemplateService } from '../../../domain/services/confirmation-template.service';
import { NotificationTemplateService } from '@telegram/notification/single-trade/domain/services/notification-template.service';
import { StartMonitoringCommand } from '@trade/engine/application/commands/start-monitoring/command';
import { TradeStatus } from '@trade/shared';
import { getTelegramConfig } from '@config/telegram.config';
import { TradeDisplayService } from '@telegram/notification/trade-list/domain/services/trade-display.service';
import { PRICE_CACHE_PORT, PriceCachePort } from '@price/cache/domain/ports/price-cache.port';

@CommandHandler(ApproveTradeCommand)
export class ApproveTradeHandler implements ICommandHandler<ApproveTradeCommand> {
  private readonly logger: LoggerPort;

  constructor(
    @Inject(LOGGER_PORT) logger: LoggerPort,
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    private readonly commandBus: CommandBus,
    @Inject(TELEGRAM_PORT) private readonly telegram: any,
    private readonly templates: ConfirmationTemplateService,
    private readonly notificationTemplates: NotificationTemplateService,
    private readonly displayService: TradeDisplayService,
    @Inject(PRICE_CACHE_PORT) private readonly priceCache: PriceCachePort,
  ) {
    this.logger = logger;
  }

  async execute(command: ApproveTradeCommand): Promise<void> {
    const telegramConfig = getTelegramConfig();
    this.logger.info(`Approving trade ${command.tradeId}`);
    this.logger.debug(`Config: groupId=${telegramConfig.groupId}, singleTradeThreadId=${telegramConfig.singleTradeThreadId}, tradeListThreadId=${telegramConfig.tradeListThreadId}`);
    this.logger.debug(`Command: chatId=${command.chatId}`);

    const trade = await this.repository.findById(command.tradeId);
    if (!trade) {
      this.logger.error(`Trade ${command.tradeId} not found`);
      await this.telegram.sendMessage(command.chatId, `❌ Trade not found. It may have been cancelled.`, undefined, telegramConfig.singleTradeThreadId);
      return;
    }

    if (trade.status !== TradeStatus.PENDING) {
      this.logger.warn(`Trade ${command.tradeId} is not in PENDING status (current: ${trade.status})`);
    }

    const updatedTrade = await this.repository.update(command.tradeId, { status: TradeStatus.ACTIVE });
    this.logger.info(`Trade ${command.tradeId} status updated to ACTIVE`);

    if (!updatedTrade) {
      this.logger.error(`Failed to update trade ${command.tradeId}`);
      return;
    }

    await this.commandBus.execute(new StartMonitoringCommand(updatedTrade.id));
    this.logger.info(`Monitoring started for trade ${command.tradeId}`);

    const message = this.templates.formatTradeApproved(updatedTrade);
    this.logger.debug(`Message for private chat:\n${message}`);
    this.logger.debug(`Sending to private chat ${command.chatId} with threadId=${telegramConfig.singleTradeThreadId}`);
    await this.telegram.sendMessage(command.chatId, message, undefined, telegramConfig.singleTradeThreadId);

    const newTradeMessage = this.notificationTemplates.formatTradeCreated(updatedTrade);
    this.logger.debug(`Sending NEW TRADE to group ${telegramConfig.groupId} with threadId=${telegramConfig.singleTradeThreadId}:\n${newTradeMessage}`);
    const newTradeMessageId = await this.telegram.sendMessage(telegramConfig.groupId, newTradeMessage, undefined, telegramConfig.singleTradeThreadId);
    await this.repository.update(command.tradeId, { notificationMessageId: newTradeMessageId });

    const allTrades = await this.repository.findAll();
    const symbols = [...new Set(allTrades.map(t => t.symbol))];
    const prices = this.priceCache.getBySymbols(symbols);
    const result = this.displayService.formatTradeList(allTrades, prices, 1, 100);
    const tradeListMessage = result.trades.join('\n\n');
    this.logger.debug(`Message for group (trade list):\n${tradeListMessage}`);
    this.logger.debug(`Sending to group ${telegramConfig.groupId} with threadId=${telegramConfig.tradeListThreadId}`);
    await this.telegram.sendMessage(telegramConfig.groupId, tradeListMessage, { parse_mode: 'HTML' }, telegramConfig.tradeListThreadId);
  }
}