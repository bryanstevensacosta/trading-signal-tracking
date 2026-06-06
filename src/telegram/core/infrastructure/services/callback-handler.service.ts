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
import { CloseTradeConfirmationCommand } from '../../../notification/trade-approval/application/commands/close-trade/command';
import { EditTradeFieldCommand } from '../../../notification/trade-approval/application/commands/edit-trade-field/command';
import { EditTradeTPCommand } from '../../../notification/trade-approval/application/commands/edit-trade-tp/command';
import { CleanDatabaseCommand } from '../../../cmd/mutation/application/commands';
import { CommandResponse } from '../../../cmd/application/command-response';
import { TradeSelectionStateManager } from '@telegram/shared/domain/services';
import { TradeDetailFormatter } from '@telegram/shared/formatters/trade-detail-formatter.service';
import { TradeSelectionListFormatter } from '@telegram/shared/formatters/trade-selection-list-formatter.service';
import { GetTradesForSelectionQuery } from '@trade/repository/application/queries/get-trades-for-selection';

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
    private readonly selectionStateManager: TradeSelectionStateManager,
    private readonly detailFormatter: TradeDetailFormatter,
    @Inject(LOGGER_PORT) logger: LoggerPort,
  ) {
    this.logger = logger;
  }

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

    if (data === 'confirm_clean') {
      this.logger.info(`Cleaning database for chat ${chatId}`);
      const result = await this.commandBus.execute(new CleanDatabaseCommand(chatId)) as CommandResponse;
      await ctx.answerCbQuery('Database cleaned');
      await ctx.reply(result.message);
      return;
    } else if (data === 'cancel_clean') {
      await ctx.answerCbQuery('Cancelled');
      await ctx.reply('❌ Database cleanup cancelled.');
      return;
    }

    if (data.startsWith('sel_page:')) {
      const page = parseInt(data.split(':')[1], 10);
      const pageInfo = this.selectionStateManager.getSelectionPage(chatId);
      if (pageInfo) {
        await ctx.answerCbQuery();
        await this.handleSelectionPage(ctx, chatId, page, pageInfo.messageId);
      } else {
        await ctx.answerCbQuery('Selection expired, use /trade-edit again');
      }
      return;
    }

    if (data === 'noop') {
      await ctx.answerCbQuery();
      return;
    }

    if (data.startsWith('sel_back:')) {
      await ctx.answerCbQuery();
      await this.handleBackToDetail(ctx, chatId, data.split(':')[1]);
      return;
    }

    if (data.startsWith('sel_confirm:')) {
      const parts = data.split(':');
      const action = parts[1];
      const id = parts[2];
      await ctx.answerCbQuery();
      await this.handleSelectionConfirm(ctx, action, id, chatId);
      return;
    }

    if (data.startsWith('sel_cancel:') || data.startsWith('sel_close:') || data.startsWith('sel_edit:')) {
      await ctx.answerCbQuery();
      await this.handleSelectionAction(ctx, data, chatId);
      return;
    }

    const tradeId = this.extractTradeId(data);
    if (!tradeId) {
      await ctx.answerCbQuery('Invalid trade ID');
      return;
    }

    await this.handleAction(ctx, data, tradeId, chatId, messageId);
  }

  private async handleAction(
    ctx: Context,
    data: string,
    tradeId: string,
    chatId: number,
    messageId?: number,
  ): Promise<void> {
    if (data.startsWith('confirm_approve:')) {
      this.logger.info(`Trade approved: ${tradeId}`);
      await this.commandBus.execute(new ApproveTradeCommand(tradeId, chatId, messageId));
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

  private async handleSelectionPage(ctx: Context, chatId: number, page: number, listMessageId: number): Promise<void> {
    const result = await this.commandBus.execute(new GetTradesForSelectionQuery(page, 5)) as { trades: any[]; total: number; page: number; totalPages: number };

    const formatter = new TradeSelectionListFormatter();
    const formatted = formatter.formatList(result.trades, page);

    const navigationButtons: any[][] = [];
    if (formatted.hasPrev || formatted.hasNext) {
      const navRow: any[] = [];
      if (formatted.hasPrev) {
        navRow.push({ text: '◀', callback_data: `sel_page:${page - 1}` });
      }
      navRow.push({ text: `${page}/${formatted.navigation.total}`, callback_data: 'noop' });
      if (formatted.hasNext) {
        navRow.push({ text: '▶', callback_data: `sel_page:${page + 1}` });
      }
      navigationButtons.push(navRow);
    }

    const message = `${formatted.header}\n\n${formatted.items.join('\n\n')}`;

    await ctx.telegram.editMessageText(chatId, listMessageId, undefined, message, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: navigationButtons },
    });

    this.selectionStateManager.setSelectionPage(chatId, page, formatted.navigation.total, formatted.navigation.total, listMessageId);
  }

  private async handleBackToDetail(ctx: Context, chatId: number, tradeId: string): Promise<void> {
    const state = this.selectionStateManager.getSelectionState(chatId);
    if (!state) {
      await ctx.reply('Session expired, use /trade-edit again');
      return;
    }

    const trade = await this.repository.findById(tradeId);
    if (!trade) {
      await ctx.reply('Trade not found');
      return;
    }

    const detail = this.detailFormatter.formatDetail(trade);
    await ctx.telegram.editMessageText(chatId, state.messageId, undefined, detail.text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: detail.buttons },
    });
  }

  private async handleSelectionAction(ctx: Context, data: string, chatId: number): Promise<void> {
    const state = this.selectionStateManager.getSelectionState(chatId);
    if (!state) {
      await ctx.reply('Session expired, use /trade-edit again');
      return;
    }

    let action: string;
    let tradeId: string;
    let field: string = 'sl';

    if (data.startsWith('sel_cancel:')) {
      action = 'cancel';
      tradeId = data.split(':')[1];
    } else if (data.startsWith('sel_close:')) {
      action = 'close';
      tradeId = data.split(':')[1];
    } else if (data.startsWith('sel_edit:')) {
      const parts = data.split(':');
      tradeId = parts[1];
      field = parts[2];
      action = `edit_${field}`;
    } else {
      return;
    }

    const trade = await this.repository.findById(tradeId);
    if (!trade) {
      await ctx.reply('Trade not found');
      return;
    }

    if (action === 'cancel' || action === 'close') {
      const confirmation = this.detailFormatter.formatConfirmation(action, trade);
      await ctx.telegram.editMessageText(chatId, state.messageId, undefined, confirmation.text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: confirmation.buttons },
      });
    } else if (action.startsWith('edit_')) {
      const editField = field || 'sl';
      const prompt = this.detailFormatter.formatEditPrompt(trade, editField);
      await ctx.telegram.editMessageText(chatId, state.messageId, undefined, prompt, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '◀ Back', callback_data: `sel_back:${tradeId}` }]],
        },
      });
      this.editStateManager.startEditing(chatId, tradeId, state.messageId, editField);
    }
  }

  private async handleSelectionConfirm(ctx: Context, action: string, tradeId: string, chatId: number): Promise<void> {
    const state = this.selectionStateManager.getSelectionState(chatId);
    if (!state) {
      await ctx.reply('Session expired, use /trade-edit again');
      return;
    }

    try {
      if (action === 'cancel') {
        await this.commandBus.execute(new CancelTradeConfirmationCommand(tradeId, chatId));
        await ctx.telegram.editMessageText(chatId, state.messageId, undefined, `❌ Trade ${tradeId} cancelled.`, {});
      } else if (action === 'close') {
        await this.commandBus.execute(new CloseTradeConfirmationCommand(tradeId, chatId));
        await ctx.telegram.editMessageText(chatId, state.messageId, undefined, `🔴 Trade ${tradeId} closed.`, {});
      }
      this.selectionStateManager.clearSelectionState(chatId);
    } catch (error) {
      this.logger.error(`Error ${action}ing trade: ${error}`);
      await ctx.reply(`Failed to ${action} trade. Please try again.`);
    }
  }

  private async handleEditMode(ctx: Context, tradeId: string, chatId: number, _messageId?: number): Promise<void> {
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

  private handleEditField(ctx: Context, field: string, tradeId: string, chatId: number, messageId?: number): void {
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

  private async handleSetSide(ctx: Context, data: string, tradeId: string, chatId: number): Promise<void> {
    const parts = data.split(':');
    const side = parts[1];
    await this.commandBus.execute(new EditTradeFieldCommand(tradeId, 'side', side, chatId));
    await ctx.answerCbQuery(`Side set to ${side}`);
  }

  private async handleRemoveTP(ctx: Context, data: string, tradeId: string, chatId: number): Promise<void> {
    await this.commandBus.execute(new EditTradeTPCommand(tradeId, 'remove', chatId));
    await ctx.answerCbQuery('Last TP removed');
  }

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
      /^sel_cancel:(.+)$/,
      /^sel_close:(.+)$/,
      /^sel_edit:(.+)$/,
      /^sel_back:(.+)$/,
      /^sel_confirm:\w+:(.+)$/,
    ];

    for (const pattern of patterns) {
      const match = data.match(pattern);
      if (match) return match[1];
    }
    return null;
  }
}