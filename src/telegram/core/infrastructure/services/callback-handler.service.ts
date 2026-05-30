import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Context } from 'telegraf';
import { CommandBus } from '@nestjs/cqrs';
import { LOGGER_PORT, LoggerPort } from '@shared/domain/ports/logger.port';
import { EditStateManager } from '../../../notification/trade-approval/domain/services/edit-state-manager.service';
import { TRADE_REPOSITORY_PORT, TradeRepositoryPort } from '@trade/repository/domain/ports/trade-repository.port';
import { BinanceInfoService } from '../../../notification/trade-approval/domain/services/binance-info.service';
import { TradeApprovalService } from '../../../notification/trade-approval/domain/services/confirmation-template.service';
import { ApproveTradeCommand } from '../../../notification/trade-approval/application/commands/approve-trade/command';
import { CancelTradeConfirmationCommand } from '../../../notification/trade-approval/application/commands/cancel-trade/command';
import { EditTradeFieldCommand } from '../../../notification/trade-approval/application/commands/edit-trade-field/command';
import { EditTradeTPCommand } from '../../../notification/trade-approval/application/commands/edit-trade-tp/command';
import { CleanDatabaseCommand } from '../../../command/mutation/application/commands';
import { CommandResponse } from '../../../command/application/command-response';

@Injectable()
export class CallbackHandlerService {
  private readonly logger: LoggerPort;

  constructor(
    private readonly commandBus: CommandBus,
    @Inject(forwardRef(() => EditStateManager))
    private readonly editStateManager: EditStateManager,
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    private readonly binanceInfoService: BinanceInfoService,
    private readonly confirmationTemplate: TradeApprovalService,
    @Inject(LOGGER_PORT) logger: LoggerPort,
  ) {
    this.logger = logger;
  }

  // Maneja callbacks de botones inline
  async handle(ctx: Context): Promise<void> {
    const query = ctx.callbackQuery;
    if (!query || !('data' in query)) {
      return;
    }

    const data = query.data as string;
    const chatId = ctx.chat?.id || 0;
    const messageId = 'message' in query ? query.message?.message_id : undefined;

    if (!chatId) {
      this.logger.warn('Callback query without chatId');
      return;
    }

    this.logger.debug(`Callback query: ${data} from chat ${chatId}`);

    // Clean database confirmation
    if (data === 'confirm_clean') {
      this.logger.info(`Cleaning database for chat ${chatId}`);
      const result = await this.commandBus.execute(
        new CleanDatabaseCommand(chatId),
      ) as CommandResponse;
      await ctx.answerCbQuery('Database cleaned');
      await ctx.reply(result.message);
      return;
    } else if (data === 'cancel_clean') {
      await ctx.answerCbQuery('Cancelled');
      await ctx.reply('❌ Database cleanup cancelled.');
      return;
    }

    // Extract trade ID from callback data
    const tradeId = this.extractTradeId(data);
    if (!tradeId) {
      await ctx.answerCbQuery('Invalid trade ID');
      return;
    }

    // Handle approve/cancel/edit actions
    await this.handleAction(ctx, data, tradeId, chatId, messageId);
  }

  // Maneja acciones específicas
  private async handleAction(
    ctx: Context,
    data: string,
    tradeId: string,
    chatId: number,
    messageId?: number,
  ): Promise<void> {
    if (data.startsWith('confirm_approve:')) {
      this.logger.info(`Trade approved: ${tradeId}`);
      await this.commandBus.execute(new ApproveTradeCommand(tradeId, chatId));
      await ctx.answerCbQuery('Trade approved! Monitoring started.');
    } else if (data.startsWith('confirm_cancel:')) {
      this.logger.info(`Trade cancelled: ${tradeId}`);
      await this.commandBus.execute(new CancelTradeConfirmationCommand(tradeId, chatId));
      await ctx.answerCbQuery('Trade cancelled');
    } else if (data.startsWith('confirm_edit:')) {
      await this.handleEditMode(ctx, tradeId, chatId, messageId);
    } else if (data.startsWith('edit_side:')) {
      this.handleEditField(ctx, 'side', tradeId, chatId, messageId);
    } else if (data.startsWith('edit_entry:')) {
      this.handleEditField(ctx, 'entry', tradeId, chatId, messageId);
    } else if (data.startsWith('edit_sl:')) {
      this.handleEditField(ctx, 'sl', tradeId, chatId, messageId);
    } else if (data.startsWith('edit_tps:')) {
      this.handleEditField(ctx, 'tps', tradeId, chatId, messageId);
    } else if (data.startsWith('set_side:')) {
      await this.handleSetSide(ctx, data, tradeId, chatId);
    } else if (data.startsWith('edit_tp_add:')) {
      this.handleEditField(ctx, 'tps', tradeId.split(':')[1], chatId, messageId);
    } else if (data.startsWith('edit_tp_remove:')) {
      await this.handleRemoveTP(ctx, data, tradeId, chatId);
    } else {
      await ctx.answerCbQuery('Unknown action');
    }
  }

  // Modo edición - muestra botones para modificar campos
  private async handleEditMode(
    ctx: Context,
    tradeId: string,
    chatId: number,
    _messageId?: number,
  ): Promise<void> {
    const pendingTrade = this.editStateManager.getPendingTrade(chatId, tradeId);
    if (!pendingTrade) {
      await ctx.answerCbQuery('Trade session expired, please send a new trade');
      return;
    }

    try {
      const trade = await this.repository.findById(tradeId);
      if (!trade) {
        await ctx.answerCbQuery('Trade not found');
        return;
      }

      const binanceInfo = await this.binanceInfoService.getSymbolInfo(trade.symbol, trade.side);
      const { text, buttons } = this.confirmationTemplate.formatEditMode(
        {
          symbol: trade.symbol,
          side: trade.side,
          orderType: trade.orderType,
          entry: trade.entry,
          entryMax: trade.entryMax || null,
          sl: trade.sl || null,
          tps: trade.tps || null,
          chartUrl: trade.chartUrl || null,
          notes: trade.notes || null,
        },
        binanceInfo,
        tradeId,
      );

      const inlineButtons = [
        ...buttons.edit,
        ...buttons.approve,
        ...buttons.cancel,
      ];

      await ctx.editMessageText(text, {
        reply_markup: { inline_keyboard: inlineButtons },
      });
    } catch (error) {
      this.logger.error(`Error showing edit mode: ${error}`);
      await ctx.answerCbQuery('Error loading edit mode');
    }
  }

  // Iniciar edición de campo
  private handleEditField(
    ctx: Context,
    field: string,
    tradeId: string,
    chatId: number,
    messageId?: number,
  ): void {
    const pendingTrade = this.editStateManager.getPendingTrade(chatId, tradeId);
    if (messageId) {
      this.editStateManager.startEditing(chatId, tradeId, messageId, field, pendingTrade?.confirmationMessageId);
    }

    const messages: Record<string, string> = {
      side: 'Select new direction',
      entry: 'Enter new entry price',
      sl: 'Enter new SL price',
      tps: 'Enter new TP values (comma separated)',
    };
    ctx.answerCbQuery(messages[field] || 'Enter new value');
  }

  // Set side directamente desde botón
  private async handleSetSide(ctx: Context, data: string, tradeId: string, chatId: number): Promise<void> {
    const parts = data.split(':');
    const side = parts[1];
    await this.commandBus.execute(new EditTradeFieldCommand(tradeId, 'side', side, chatId));
    await ctx.answerCbQuery(`Side set to ${side}`);
  }

  // Remover último TP
  private async handleRemoveTP(ctx: Context, data: string, tradeId: string, chatId: number): Promise<void> {
    await this.commandBus.execute(new EditTradeTPCommand(tradeId, 'remove', chatId));
    await ctx.answerCbQuery('Last TP removed');
  }

  // Extraer trade ID de callback data
  private extractTradeId(data: string): string | null {
    const patterns = [
      /^confirm_approve:(.+)$/,
      /^confirm_cancel:(.+)$/,
      /^confirm_edit:(.+)$/,
      /^edit_side:(.+)$/,
      /^edit_entry:(.+)$/,
      /^edit_sl:(.+)$/,
      /^edit_tps:(.+)$/,
      /^set_side:\w+:(.+)$/,
      /^edit_tp_add:(.+)$/,
      /^edit_tp_remove:(.+)$/,
    ];

    for (const pattern of patterns) {
      const match = data.match(pattern);
      if (match) return match[1];
    }
    return null;
  }
}