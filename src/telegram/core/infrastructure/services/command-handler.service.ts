import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Context, Input } from 'telegraf';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { LOGGER_PORT, LoggerPort } from '@shared/domain/ports/logger.port';
import { CommandResponse } from '../../../cmd/application/command-response';
import {
  StartCommand,
  HelpCommand,
  GetTradesCommand,
  GetActiveTradesCommand,
  GetTradeByIdCommand,
  GetStatsCommand,
  GetShareCardPositionPnlCommand,
  GetShareCardAccountPnlCommand,
} from '../../../cmd/query/application/commands';
import { PendingCleanupService } from '@trade/state/domain/services/pending-cleanup.service';
import { TradeSelectionListFormatter } from '@telegram/shared/formatters/trade-selection-list-formatter.service';
import { TradeDetailFormatter } from '@telegram/shared/formatters/trade-detail-formatter.service';
import { TradeSelectionStateManager } from '@telegram/shared/domain/services';
import { GetTradesForSelectionQuery } from '@trade/repository/application/queries/get-trades-for-selection';
import { PRICE_CACHE_PORT, PriceCachePort } from '@price/cache/domain/ports/price-cache.port';

@Injectable()
export class CommandHandlerService {
  private readonly logger: LoggerPort;

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    @Inject(forwardRef(() => PendingCleanupService))
    private readonly pendingCleanupService: PendingCleanupService,
    @Inject(PRICE_CACHE_PORT) private readonly priceCache: PriceCachePort,
    private readonly selectionListFormatter: TradeSelectionListFormatter,
    private readonly selectionDetailFormatter: TradeDetailFormatter,
    private readonly selectionStateManager: TradeSelectionStateManager,
    @Inject(LOGGER_PORT) logger: LoggerPort,
  ) {
    this.logger = logger;
  }

  private async cancelPendingBeforeCommand(_ctx: Context): Promise<void> {
    await this.pendingCleanupService.cancelAllPending('New command received - previous pending trade cancelled', 'auto_command');
  }

  async handleStart(ctx: Context): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    const result = await this.commandBus.execute(new StartCommand(ctx.chat?.id || 0)) as CommandResponse;
    await this.reply(ctx, result.message);
  }

  async handleHelp(ctx: Context): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    const result = await this.commandBus.execute(new HelpCommand(ctx.chat?.id || 0)) as CommandResponse;
    await this.reply(ctx, result.message);
  }

  async handleTrades(ctx: Context): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    const result = await this.commandBus.execute(new GetTradesCommand()) as CommandResponse;
    await this.reply(ctx, result.message);
  }

  async handleActive(ctx: Context): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    const result = await this.commandBus.execute(new GetActiveTradesCommand()) as CommandResponse;
    await this.reply(ctx, result.message);
  }

  async handleHistory(ctx: Context, args?: string): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    const exportCsv = args?.trim().toLowerCase() === 'csv';
    const result = await this.commandBus.execute(new GetTradesCommand('history', 1, exportCsv)) as CommandResponse;
    if (result.file) {
      await ctx.replyWithDocument(Input.fromBuffer(result.file.buffer, result.file.filename), { caption: result.message });
    } else {
      await this.reply(ctx, result.message);
    }
  }

  async handleStats(ctx: Context): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    const result = await this.commandBus.execute(new GetStatsCommand()) as CommandResponse;
    await this.reply(ctx, result.message);
  }

  async handleTrade(ctx: Context, tradeId?: string): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    const chatId = ctx.chat?.id || 0;

    if (!tradeId) {
      await this.sendTradeSelectionList(ctx, chatId, 1);
      return;
    }

    const state = this.selectionStateManager.getSelectionState(chatId);
    if (state && state.tradeId === tradeId) {
      await this.sendTradeDetail(ctx, tradeId, state.listMessageId);
      return;
    }

    const result = await this.commandBus.execute(new GetTradeByIdCommand(tradeId)) as CommandResponse;
    await this.reply(ctx, result.message);
  }

  async handleClean(ctx: Context): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    await ctx.reply('⚠️ Are you sure you want to delete ALL trades from the database?', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Yes, delete all', callback_data: 'confirm_clean' },
            { text: '❌ No, cancel', callback_data: 'cancel_clean' },
          ],
        ],
      },
    });
  }

  async handleShareCardPosition(ctx: Context, tradeId: string): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    if (!tradeId) {
      await this.reply(ctx, 'Usage: /share_card_position trade_id');
      return;
    }
    const result = await this.commandBus.execute(new GetShareCardPositionPnlCommand(tradeId)) as CommandResponse;
    if (result.photo) {
      await ctx.replyWithPhoto({ source: result.photo }, { caption: result.message });
    } else {
      await this.reply(ctx, result.message);
    }
  }

  async handleShareCardAccount(ctx: Context, period: string): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    const validPeriods = ['24h', '7d', '30d', 'all'];
    const parsedPeriod = validPeriods.includes(period) ? period as '24h' | '7d' | '30d' | 'all' : '24h';
    const result = await this.commandBus.execute(new GetShareCardAccountPnlCommand(parsedPeriod)) as CommandResponse;
    if (result.photo) {
      await ctx.replyWithPhoto({ source: result.photo }, { caption: result.message });
    } else {
      await this.reply(ctx, result.message);
    }
  }

  private async sendTradeSelectionList(ctx: Context, chatId: number, page: number): Promise<void> {
    const result = await this.queryBus.execute(new GetTradesForSelectionQuery(page, 5)) as {
      trades: any[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };

    const formatted = this.selectionListFormatter.formatList(result.trades, page);

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

    const sentMessage = await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: navigationButtons,
      },
    });

    this.selectionStateManager.setSelectionPage(chatId, page, formatted.navigation.total, formatted.navigation.total, sentMessage.message_id);
  }

  async sendTradeDetail(ctx: Context, tradeId: string, listMessageId: number): Promise<void> {
    const result = await this.commandBus.execute(new GetTradeByIdCommand(tradeId)) as CommandResponse;

    const symbolMatch = result.message.match(/(LONG|SHORT)\s+([A-Z]+)/);
    const side = symbolMatch ? symbolMatch[1] : 'LONG';
    const symbol = symbolMatch ? symbolMatch[2] : 'UNKNOWN';

    const currentPrice = this.priceCache.getBySymbols([symbol + 'USDT'])[0]?.last;

    const trade = {
      id: tradeId,
      symbol: symbol + 'USDT',
      side: side,
      status: result.message.includes('ACTIVE') ? 'active' : result.message.includes('PENDING') ? 'pending' : 'active',
      entry: this.extractValue(result.message, 'ENTRY:'),
      entryMax: undefined,
      sl: this.extractValue(result.message, 'SL:'),
      tps: this.extractTPs(result.message),
      tpsHit: [],
      notes: null,
    };

    const detail = this.selectionDetailFormatter.formatDetail(trade as any, currentPrice);

    await ctx.telegram.editMessageText(ctx.chat?.id || 0, listMessageId, undefined, detail.text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: detail.buttons },
    });

    const chatId = ctx.chat?.id || 0;
    this.selectionStateManager.setSelectionState(chatId, tradeId, listMessageId, listMessageId);
  }

  private extractValue(text: string, field: string): string | undefined {
    const match = text.match(new RegExp(`${field}\\s*([\\d.]+)`));
    return match ? match[1] : undefined;
  }

  private extractTPs(text: string): string[] | undefined {
    const match = text.match(/TP:\s*(.+?)(?:\n|$)/);
    if (!match) return undefined;
    const tpText = match[1].replace(/[^0-9./]/g, '');
    return tpText.split('/').filter(t => t.trim()).map(t => t.trim());
  }

  private async reply(ctx: Context, text: string): Promise<void> {
    await ctx.reply(text, { parse_mode: 'HTML' });
  }
}