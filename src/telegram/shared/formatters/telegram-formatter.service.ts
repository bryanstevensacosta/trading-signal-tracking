import { Injectable } from '@nestjs/common';
import { Trade } from '@trade/shared';
import { formatSideEmoji, formatStatusFull, formatStatusEmoji, formatTps, isActive, isClosed, calculateTradeSummary } from '@telegram/shared/helpers';
import { TradeSummary } from '@trade/statistics/domain/services';

export interface FormatOptions {
  html?: boolean;
  compact?: boolean;
}

const MESSAGE_TEMPLATES = {
  HELP: `
  📚 Available Commands:

  📊 Query Commands:
  /start - Start the bot
  /help - Show this help
  /trades - List all trades
  /active - List active trades
  /history - List closed trades
  /stats - Show trading statistics
  /trade [id] - Show trade details
  /price [symbol] - Show current price

  ✏️ Mutation Commands:
  /cancel [id] - Cancel pending trade
  /delete [id] - Delete closed trade
  /entry [id] [price] - Modify entry price
  /sl [id] [price] - Modify stop loss
  /tp [id] [n] [price] - Modify take profit
  /close [id] - Manually close trade
  /be [id] - Move to breakeven
  `.trim(),

  WELCOME: `
  👋 Welcome to Crypto Signals Bot!

  I help you manage your trades by tracking entry, stop loss, and take profit levels.

  📈 Features:
  • Track LONG/SHORT/SPOT trades
  • Automatic alerts on TP/SL hits
  • Manual trade management

  Use /help to see all commands.
  `.trim(),

  STATS: (stats: {
    totalTrades: number;
    winRate: number;
    averageRR: number;
    totalRR: number;
    breakEvenRate: number;
    profitability: string;
    bestTrade: { rr: number } | null;
    worstTrade: { rr: number } | null;
    tradesThisWeek: number;
    tradesThisMonth: number;
  }) => `
  📈 Statistics (All Time)

  Total: ${stats.totalTrades} trades
  Win Rate: ${(stats.winRate * 100).toFixed(1)}%
  Total R/R: ${stats.totalRR.toFixed(2)}R
  Avg R/R: ${stats.averageRR.toFixed(2)}R
  BreakEven: ${(stats.breakEvenRate * 100).toFixed(1)}%
  Status: ${stats.profitability}

  Best: ${stats.bestTrade && stats.bestTrade.rr > 0 ? `+${stats.bestTrade.rr.toFixed(2)}R` : '-'}

  This Week: ${stats.tradesThisWeek} trades
  This Month: ${stats.tradesThisMonth} trades
  `.trim(),
};

@Injectable()
export class TelegramFormatter {
  formatTradeRow(trade: Trade, index: number, options: FormatOptions = {}): string {
    const { html = false } = options;
    const side = formatSideEmoji(trade.side);
    const emoji = formatStatusEmoji(trade.status);

    const bold = (text: string) => html ? `<b>${text}</b>` : text;

    if (trade.status === 'pending') {
      return `${index}. ${side} ${trade.symbol} @ ${trade.entry} ⏳`;
    }

    let row = `${index}. ${side} ${bold(trade.symbol)} @ ${trade.entry} ${emoji}`;

    if (trade.sl || trade.tps) {
      row += html ? '\n   ' : '\n   ';
      if (trade.sl) row += `SL: ${trade.sl} | `;
      if (trade.tps) row += `TP: ${formatTps(trade.tps, trade.tpsHit)}`;
    }

    return row;
  }

  formatForList(trades: Trade[], _options: FormatOptions = {}): string {
    if (trades.length === 0) {
      return 'No trades found';
    }

    const lines = trades.map((trade, index) => {
      const status = formatStatusFull(trade.status);
      return `${index + 1}. ${trade.side} ${trade.symbol} @ ${trade.entry} [${status}]`;
    });

    return lines.join('\n');
  }

  formatForDisplay(trade: Trade, options: FormatOptions = {}): string {
    const { html = false } = options;
    const sideEmoji = formatSideEmoji(trade.side);
    const status = formatStatusFull(trade.status);

    const bold = (text: string) => html ? `<b>${text}</b>` : text;

    const lines: string[] = [
      `${sideEmoji} ${trade.side} ${bold(trade.symbol)}`,
      `Entry: ${trade.entry}${trade.entryMax ? `-${trade.entryMax}` : ''}`,
    ];

    if (trade.sl) {
      lines.push(`SL: ${trade.sl}`);
    }

    if (trade.tps && trade.tps.length > 0) {
      lines.push(`TP: ${trade.tps.join(' / ')}`);
    }

    lines.push(`Status: ${status}`);

    if (trade.notes) {
      lines.push(`Notes: ${trade.notes}`);
    }

    return lines.join('\n');
  }

  formatTradeList(trades: Trade[], options: FormatOptions = {}): string {
    const { html = false } = options;

    if (trades.length === 0) {
      return html ? '📊 <b>TRADES</b>\n\nNo trades yet' : 'No trades found';
    }

    const activeTrades = trades.filter(t => isActive(t.status));
    const closedTrades = trades.filter(t => isClosed(t.status));

    const lines: string[] = [html ? '📊 <b>TRADES</b>\n' : '📊 TRADES\n'];

    if (activeTrades.length > 0) {
      lines.push(html ? '<b>Active:</b>' : 'Active:');
      activeTrades.forEach((trade, i) => {
        lines.push(this.formatTradeRow(trade, i + 1, options));
      });
      lines.push('');
    }

    if (closedTrades.length > 0) {
      lines.push(html ? '<b>Closed:</b>' : 'Closed:');
      closedTrades.slice(0, 5).forEach((trade, i) => {
        lines.push(this.formatTradeRow(trade, i + 1, { ...options, compact: true }));
      });

      if (closedTrades.length > 5) {
        lines.push(`... and ${closedTrades.length - 5} more`);
      }
    }

    const summary = this.calculateSummary(trades);
    lines.push('');
    lines.push(html 
      ? `<b>Summary:</b> ${summary.wins}W / ${summary.losses}L | ${summary.winRate}% WR`
      : `Summary: ${summary.wins}W / ${summary.losses}L | ${summary.winRate}% WR`
    );

    return lines.join('\n');
  }

  calculateSummary(trades: Trade[]): TradeSummary {
    return calculateTradeSummary(trades);
  }

  formatHelp(): string {
    return MESSAGE_TEMPLATES.HELP;
  }

  formatWelcome(): string {
    return MESSAGE_TEMPLATES.WELCOME;
  }

  format(stats: {
    totalTrades: number;
    winRate: number;
    averageRR: number;
    totalRR: number;
    breakEvenRate: number;
    profitability: string;
    bestTrade: { rr: number } | null;
    worstTrade: { rr: number } | null;
    tradesThisWeek: number;
    tradesThisMonth: number;
  }): string {
    return MESSAGE_TEMPLATES.STATS(stats);
  }
}