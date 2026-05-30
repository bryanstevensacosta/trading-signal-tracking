import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { LoggerPort, LOGGER_PORT } from '@shared/domain/ports/logger.port';
import { EditTradeFieldCommand } from './command';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '@trade/repository/domain/ports/trade-repository.port';
import { BinanceInfoService } from '../../../domain/services/binance-info.service';
import { TradeApprovalService } from '../../../domain/services/confirmation-template.service';
import { TELEGRAM_PORT, TelegramPort } from '@telegram/core/domain/ports/telegram.port';
import { EditStateManager } from '../../../domain/services/edit-state-manager.service';
import { getTelegramConfig } from '@config/telegram.config';

@CommandHandler(EditTradeFieldCommand)
export class EditTradeFieldHandler implements ICommandHandler<EditTradeFieldCommand> {
  private readonly logger: LoggerPort;

  constructor(
    @Inject(LOGGER_PORT) logger: LoggerPort,
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    private readonly binanceInfoService: BinanceInfoService,
    private readonly confirmationTemplate: TradeApprovalService,
    @Inject(TELEGRAM_PORT) private readonly telegram: TelegramPort,
    private readonly editStateManager: EditStateManager,
  ) {
    this.logger = logger;
  }

  async execute(command: EditTradeFieldCommand): Promise<void> {
    const { tradeId, field, value, chatId } = command;
    const telegramConfig = getTelegramConfig();

    this.logger.info(`Editing field ${field} for trade ${tradeId} with value ${value}`);

    const trade = await this.repository.findById(tradeId);
    if (!trade) {
      this.logger.error(`Trade ${tradeId} not found`);
      await this.telegram.sendMessage(chatId, `❌ Trade not found.`, undefined, telegramConfig.singleTradeThreadId);
      return;
    }

    const updateData: Record<string, unknown> = {};

    switch (field) {
      case 'side':
        updateData.side = value.toUpperCase();
        break;
      case 'entry':
        updateData.entry = parseFloat(value);
        break;
      case 'sl':
        updateData.sl = parseFloat(value);
        break;
      case 'tps': {
        const tpValues = value.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
        updateData.tps = tpValues;
        break;
      }
      default:
        this.logger.warn(`Unknown field: ${field}`);
        return;
    }

    const updatedTrade = await this.repository.update(tradeId, updateData);
    this.logger.info(`Trade ${tradeId} field ${field} updated to ${value}`);

    if (!updatedTrade) {
      this.logger.error(`Failed to update trade ${tradeId}`);
      return;
    }

    this.editStateManager.clearEditingState(chatId, tradeId);

    const pendingTrade = this.editStateManager.getPendingTrade(chatId, tradeId);
    const binanceInfo = await this.binanceInfoService.getSymbolInfo(trade.symbol, trade.side);
    const { text, buttons } = this.confirmationTemplate.formatEditMode(
      updatedTrade,
      binanceInfo,
      tradeId,
    );

    const inlineButtons = [
      ...buttons.edit,
      ...buttons.approve,
      ...buttons.cancel,
    ];

    if (pendingTrade?.confirmationMessageId) {
      await this.telegram.editMessage(
        chatId,
        pendingTrade.confirmationMessageId,
        text,
        { inline_keyboard: inlineButtons },
      );
    } else {
      await this.telegram.sendMessage(
        chatId,
        text,
        { inline_keyboard: inlineButtons },
      );
    }
  }
}