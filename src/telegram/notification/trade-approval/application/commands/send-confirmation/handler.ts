import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { LoggerPort, LOGGER_PORT } from '@shared/domain/ports/logger.port';
import { SendConfirmationCommand } from './command';
import { BinanceInfoService } from '../../../domain/services/binance-info.service';
import { TradeApprovalService } from '../../../domain/services/confirmation-template.service';
import { TELEGRAM_PORT, TelegramPort } from '@telegram/core/domain/ports/telegram.port';
import { SaveTradeCommand } from '@trade/repository/application/commands/save-trade/command';
import { CommandBus } from '@nestjs/cqrs';
import { CreateTradeInput } from '@trade/shared';
import { EditStateManager } from '../../../domain/services/edit-state-manager.service';
import { getTelegramConfig } from '@config/telegram.config';

@CommandHandler(SendConfirmationCommand)
export class SendConfirmationHandler implements ICommandHandler<SendConfirmationCommand> {
  private readonly logger: LoggerPort;

  constructor(
    @Inject(LOGGER_PORT) logger: LoggerPort,
    private readonly binanceInfoService: BinanceInfoService,
    private readonly confirmationTemplate: TradeApprovalService,
    @Inject(TELEGRAM_PORT) private readonly telegramAdapter: TelegramPort,
    private readonly commandBus: CommandBus,
    private readonly editStateManager: EditStateManager,
  ) {
    this.logger = logger;
  }

  async execute(command: SendConfirmationCommand): Promise<string> {
    const { parsedTrade, chatId, sourceMessage } = command;
    const telegramConfig = getTelegramConfig();

    this.logger.debug(`Creating pending trade for ${parsedTrade.symbol} in chat ${chatId}`);
    this.logger.debug(`Config: groupId=${telegramConfig.groupId}, singleTradeThreadId=${telegramConfig.singleTradeThreadId}, tradeListThreadId=${telegramConfig.tradeListThreadId}`);

    const input: CreateTradeInput = {
      symbol: parsedTrade.symbol,
      side: parsedTrade.side,
      orderType: parsedTrade.orderType,
      entry: parsedTrade.entry,
      entryMax: parsedTrade.entryMax || undefined,
      sl: parsedTrade.sl || undefined,
      tps: parsedTrade.tps || undefined,
      chartUrl: parsedTrade.chartUrl || undefined,
      notes: parsedTrade.notes || undefined,
      sourceMessage: sourceMessage,
      sourceChat: chatId,
    };

    const savedTrade = await this.commandBus.execute(new SaveTradeCommand(input));
    this.logger.info(`Trade saved with PENDING status: ${savedTrade.id}`);

    const binanceInfo = await this.binanceInfoService.getSymbolInfo(parsedTrade.symbol, parsedTrade.side);
    const { text, buttons } = this.confirmationTemplate.formatConfirmation(
      parsedTrade,
      binanceInfo,
      savedTrade.id,
    );

    const inlineButtons = [
      ...buttons.edit,
      ...buttons.approve,
      ...buttons.cancel,
    ];

    this.logger.debug(`Sending confirmation to private chat ${chatId} with ${inlineButtons.length} button rows`);
    const messageId = await this.telegramAdapter.sendMessage(
      chatId,
      text,
      {
        reply_markup: JSON.stringify({ inline_keyboard: inlineButtons }),
      },
    );

    this.editStateManager.addPendingTrade(chatId, savedTrade.id, messageId, messageId, buttons.edit);
    this.logger.info(`Confirmation sent for trade ${savedTrade.id} with messageId ${messageId}`);

    return savedTrade.id;
  }
}