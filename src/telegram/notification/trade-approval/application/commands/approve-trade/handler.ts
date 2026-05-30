import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { LoggerPort, LOGGER_PORT } from '@shared/domain/ports/logger.port';
import { CommandBus } from '@nestjs/cqrs';
import { ApproveTradeCommand } from './command';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '@trade/repository/domain/ports/trade-repository.port';
import { TELEGRAM_PORT, TelegramPort } from '@telegram/core/domain/ports/telegram.port';
import { TradeApprovalService } from '../../../domain/services/confirmation-template.service';
import { TradeAlertService } from '@telegram/notification/trade-alerts/domain/services/trade-alert.service';
import { StartMonitoringCommand } from '@trade/engine/application/commands/start-monitoring/command';
import { TradeStatus } from '@trade/shared';
import { getTelegramConfig } from '@config/telegram.config';
import { TradeListService } from '@telegram/notification/trade-list/domain/services/trade-list.service';
import { PRICE_CACHE_PORT, PriceCachePort } from '@price/cache/domain/ports/price-cache.port';

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
    private readonly displayService: TradeListService,
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

    await this.commandBus.execute(new StartMonitoringCommand(trade.id));
    this.logger.info(`Monitoring started for trade ${command.tradeId}`);

    await this.repository.update(command.tradeId, { approvedAt: new Date() });
    this.logger.info(`Trade ${command.tradeId} marked as approved at ${new Date().toISOString()}`);

    await this.telegram.sendMessage(command.chatId, this.templates.formatTradeApproved(trade), undefined, telegramConfig.singleTradeThreadId);

    const newTradeMessage = this.notificationTemplates.formatTradeCreated(trade);
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