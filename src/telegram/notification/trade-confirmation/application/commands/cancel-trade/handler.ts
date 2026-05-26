import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { LoggerPort, LOGGER_PORT } from '@shared/domain/ports/logger.port';
import { CancelTradeConfirmationCommand } from './command';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '@trade/repository/domain/ports/trade-repository.port';
import { TELEGRAM_PORT } from '@telegram/notification/single-trade/domain/ports/telegram.port';
import { ConfirmationTemplateService } from '../../../domain/services/confirmation-template.service';
import { TradeStatus } from '@trade/shared';
import { getTelegramConfig } from '@config/telegram.config';

@CommandHandler(CancelTradeConfirmationCommand)
export class CancelTradeHandler implements ICommandHandler<CancelTradeConfirmationCommand> {
  private readonly logger: LoggerPort;

  constructor(
    @Inject(LOGGER_PORT) logger: LoggerPort,
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    @Inject(TELEGRAM_PORT) private readonly telegram: any,
    private readonly templates: ConfirmationTemplateService,
  ) {
    this.logger = logger;
  }

  async execute(command: CancelTradeConfirmationCommand): Promise<void> {
    const telegramConfig = getTelegramConfig();
    this.logger.info(`Closing trade ${command.tradeId}`);

    const trade = await this.repository.findById(command.tradeId);
    if (!trade) {
      this.logger.error(`Trade ${command.tradeId} not found`);
      await this.telegram.sendMessage(command.chatId, `❌ Trade not found.`, undefined, telegramConfig.singleTradeThreadId);
      return;
    }

    await this.repository.update(command.tradeId, { status: TradeStatus.CANCELLED });
    this.logger.info(`Trade ${command.tradeId} marked as CANCELLED`);

    const message = this.templates.formatTradeClosed(trade.symbol);
    await this.telegram.sendMessage(command.chatId, message, undefined, telegramConfig.singleTradeThreadId);
  }
}