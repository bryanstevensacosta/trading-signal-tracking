import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { LoggerPort, LOGGER_PORT } from '@shared/domain/ports/logger.port';
import { CloseTradeConfirmationCommand } from './command';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '@trade/repository/domain/ports/trade-repository.port';
import { TELEGRAM_PORT, TelegramPort } from '@telegram/core/domain/ports/telegram.port';
import { TradeStatus } from '@trade/shared';
import { getTelegramConfig } from '@config/telegram.config';

@CommandHandler(CloseTradeConfirmationCommand)
export class CloseTradeHandler implements ICommandHandler<CloseTradeConfirmationCommand> {
  private readonly logger: LoggerPort;

  constructor(
    @Inject(LOGGER_PORT) logger: LoggerPort,
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    @Inject(TELEGRAM_PORT) private readonly telegram: TelegramPort,
  ) {
    this.logger = logger;
  }

  async execute(command: CloseTradeConfirmationCommand): Promise<void> {
    const telegramConfig = getTelegramConfig();
    this.logger.info(`Closing trade ${command.tradeId}`);

    const trade = await this.repository.findById(command.tradeId);
    if (!trade) {
      this.logger.error(`Trade ${command.tradeId} not found`);
      await this.telegram.sendMessage(command.chatId, `❌ Trade not found.`, undefined, telegramConfig.tradeAlertsThreadId);
      return;
    }

    await this.repository.update(command.tradeId, { status: TradeStatus.CLOSED_MANUAL });
    this.logger.info(`Trade ${command.tradeId} marked as CLOSED_MANUAL`);

    await this.telegram.sendMessage(command.chatId, `🔴 Trade ${trade.symbol} closed manually.`, undefined, telegramConfig.tradeAlertsThreadId);
  }
}