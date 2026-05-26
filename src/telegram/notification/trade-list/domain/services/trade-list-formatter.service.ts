import { Injectable } from '@nestjs/common';
import { Trade, TradeStatus } from '@trade/shared';

@Injectable()
export class TradeListFormatterService {
  format(trades: Trade[]): string {
    if (trades.length === 0) {
      return this.formatEmpty();
    }

    const activeTrades = trades.filter(t => this.isActive(t.status));
    const closedTrades = trades.filter(t => this.isClosed(t.status));

    const lines: string[] = ['📊 <b>TRADES</b>\n'];

    if (activeTrades.length > 0) {
      lines.push('<b>Active:</b>');
      activeTrades.forEach((trade, i) => {
        lines.push(this.formatTradeRow(trade, i + 1));
      });
      lines.push('');
    }

    if (closedTrades.length > 0) {
      lines.push('<b>Closed:</b>');
      closedTrades.slice(0, 5).forEach((trade, i) => {
        lines.push(this.formatTradeRow(trade, i + 1, true));
      });

      if (closedTrades.length > 5) {
        lines.push(`... and ${closedTrades.length - 5} more`);
      }
    }

    const summary = this.calculateSummary(trades);
    lines.push('');
    lines.push(this.formatSummary(summary));

    return lines.join('\n');
  }

  private formatTradeRow(trade: Trade, index: number, compact = false): string {
    const emoji = this.getStatusEmoji(trade.status);
    const side = trade.side === 'LONG' ? '🟢' : trade.side === 'SHORT' ? '🔴' : '⚪';

    if (compact) {
      return `${index}. ${emoji} ${trade.symbol} ${side} @ ${trade.entry}`;
    }

    let row = `${index}. ${side} <b>${trade.symbol}</b> @ ${trade.entry}`;

    if (trade.status === 'pending') {
      row += ' ⏳';
    } else {
      row += ` ${emoji}`;
      if (trade.sl || trade.tps) {
        row += '\n   ';
        if (trade.sl) row += `SL: ${trade.sl} | `;
        if (trade.tps) row += `TP: ${trade.tps[0]}${trade.tps.length > 1 ? ` (+${trade.tps.length - 1})` : ''}`;
      }
    }

    return row;
  }

  private formatEmpty(): string {
    return '📊 <b>TRADES</b>\n\nNo trades yet';
  }

  private formatSummary(summary: { wins: number; losses: number; total: number; winRate: number }): string {
    return `<b>Summary:</b> ${summary.wins}W / ${summary.losses}L | ${summary.winRate}% WR`;
  }

  private calculateSummary(trades: Trade[]): { wins: number; losses: number; total: number; winRate: number } {
    const closed = trades.filter(t => this.isClosed(t.status));
    const wins = closed.filter(t => t.status === 'closed_win').length;
    const losses = closed.filter(t => t.status === 'closed_loss').length;
    const total = closed.length;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    return { wins, losses, total, winRate };
  }

  private isActive(status: TradeStatus): boolean {
    return ['pending', 'active', 'partial_tp', 'breakeven'].includes(status);
  }

  private isClosed(status: TradeStatus): boolean {
    return status.startsWith('closed_') || status === 'cancelled';
  }

  private getStatusEmoji(status: TradeStatus): string {
    const emojiMap: Record<TradeStatus, string> = {
      pending: '⏳',
      active: '✅',
      partial_tp: '🎯',
      breakeven: '⚖️',
      closed_win: '💰',
      closed_partial: '💵',
      closed_loss: '❌',
      closed_breakeven: '➖',
      closed_manual: '✋',
      cancelled: '🚫',
    };
    return emojiMap[status] || '📊';
  }
}