import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { LoggerPort, LOGGER_PORT } from '@shared/domain/ports/logger.port';
import { EditTradeTPCommand } from './command';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '@trade/repository/domain/ports/trade-repository.port';
import { BinanceInfoService } from '../../../domain/services/binance-info.service';
import { ConfirmationTemplateService } from '../../../domain/services/confirmation-template.service';
import { TELEGRAM_PORT } from '@telegram/notification/single-trade/domain/ports/telegram.port';
import { EditStateManager } from '../../../domain/services/edit-state-manager.service';
import { getTelegramConfig } from '@config/telegram.config';

@CommandHandler(EditTradeTPCommand)
export class EditTradeTPHandler implements ICommandHandler<EditTradeTPCommand> {
  private readonly logger: LoggerPort;

  constructor(
    @Inject(LOGGER_PORT) logger: LoggerPort,
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    private readonly binanceInfoService: BinanceInfoService,
    private readonly confirmationTemplate: ConfirmationTemplateService,
    @Inject(TELEGRAM_PORT) private readonly telegram: any,
    private readonly editStateManager: EditStateManager,
  ) {
    this.logger = logger;
  }

  async execute(command: EditTradeTPCommand): Promise<void> {
    const { tradeId, action, chatId, value } = command;
    const telegramConfig = getTelegramConfig();

    this.logger.info(`Editing TP for trade ${tradeId}, action: ${action}`);

    const trade = await this.repository.findById(tradeId);
    if (!trade) {
      this.logger.error(`Trade ${tradeId} not found`);
      await this.telegram.sendMessage(chatId, `❌ Trade not found.`, undefined, telegramConfig.singleTradeThreadId);
      return;
    }

    const currentTPs = trade.tps || [];
    let newTPs: number[];

    if (action === 'add') {
      if (!value) {
        await this.telegram.sendMessage(chatId, 'Please provide the TP value.', undefined, telegramConfig.singleTradeThreadId);
        return;
      }
      const newTP = parseFloat(value);
      if (isNaN(newTP)) {
        await this.telegram.sendMessage(chatId, 'Invalid TP value.', undefined, telegramConfig.singleTradeThreadId);
        return;
      }
      newTPs = [...currentTPs, newTP];
    } else if (action === 'remove') {
      if (currentTPs.length === 0) {
        await this.telegram.sendMessage(chatId, 'No TPs to remove.', undefined, telegramConfig.singleTradeThreadId);
        return;
      }
      newTPs = currentTPs.slice(0, -1);
    } else {
      this.logger.warn(`Unknown TP action: ${action}`);
      return;
    }

    const updatedTrade = await this.repository.update(tradeId, { tps: newTPs });
    this.logger.info(`Trade ${tradeId} TPs updated to: ${newTPs.join(', ')}`);

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
        { reply_markup: { inline_keyboard: inlineButtons } },
        telegramConfig.singleTradeThreadId,
      );
    } else {
      await this.telegram.sendMessage(
        chatId,
        text,
        { reply_markup: { inline_keyboard: inlineButtons } },
        telegramConfig.singleTradeThreadId,
      );
    }
  }
}