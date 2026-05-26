import { Injectable } from '@nestjs/common';
import { Trade, TradeStatus, TradeSide } from '@trade/shared';

@Injectable()
export class TradeFormatterService {
  formatForDisplay(trade: Trade): string {
    const sideEmoji = trade.side === TradeSide.LONG ? '🟢' : trade.side === TradeSide.SHORT ? '🔴' : '⚪';
    const status = this.formatStatus(trade.status);

    const lines: string[] = [
      `${sideEmoji} ${trade.side} ${trade.symbol}`,
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

  formatForList(trades: Trade[]): string {
    if (trades.length === 0) {
      return 'No trades found';
    }

    const lines = trades.map((trade, index) => {
      const status = this.formatStatus(trade.status);
      return `${index + 1}. ${trade.side} ${trade.symbol} @ ${trade.entry} [${status}]`;
    });

    return lines.join('\n');
  }

  formatStats(stats: {
    totalTrades: number;
    winRate: number;
    averageRR: number;
    bestTrade: number;
    worstTrade: number;
    tradesThisWeek: number;
    tradesThisMonth: number;
  }): string {
    return `
📈 Statistics (All Time)

Total: ${stats.totalTrades} trades
Win Rate: ${(stats.winRate * 100).toFixed(1)}%
Avg R/R: ${stats.averageRR.toFixed(2)}R

Best: +${stats.bestTrade.toFixed(2)}R
Worst: ${stats.worstTrade.toFixed(2)}R

This Week: ${stats.tradesThisWeek} trades
This Month: ${stats.tradesThisMonth} trades
    `.trim();
  }

  formatHelp(): string {
    return `
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
    `.trim();
  }

  formatWelcome(): string {
    return `
👋 Welcome to Crypto Signals Bot!

I help you manage your trades by tracking entry, stop loss, and take profit levels.

📈 Features:
• Track LONG/SHORT/SPOT trades
• Automatic alerts on TP/SL hits
• Manual trade management

Use /help to see all commands.
    `.trim();
  }

  private formatStatus(status: TradeStatus): string {
    const statusMap: Record<TradeStatus, string> = {
      [TradeStatus.PENDING]: '⏳ Pending',
      [TradeStatus.ACTIVE]: '✅ Active',
      [TradeStatus.PARTIAL_TP]: '🎯 Partial TP',
      [TradeStatus.BREAKEVEN]: '⚖️ Breakeven',
      [TradeStatus.CLOSED_WIN]: '💰 Won',
      [TradeStatus.CLOSED_PARTIAL]: '💵 Partial',
      [TradeStatus.CLOSED_LOSS]: '❌ Lost',
      [TradeStatus.CLOSED_BREAKEVEN]: '➖ BE',
      [TradeStatus.CLOSED_MANUAL]: '✋ Closed',
      [TradeStatus.CANCELLED]: '🚫 Cancelled',
    };

    return statusMap[status] || status;
  }
}