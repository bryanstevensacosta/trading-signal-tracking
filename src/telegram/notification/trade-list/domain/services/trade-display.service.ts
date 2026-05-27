import { Injectable } from '@nestjs/common';
import { Trade, TradeStatus, TradeSide, Price } from '@trade/shared';

export interface TradeDisplayData {
  trade: Trade;
  currentPrice: number | null;
  priceChange: number | null;
}

export interface PaginatedTradeList {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  trades: string[];
}

@Injectable()
export class TradeDisplayService {
  formatTradeList(
    trades: Trade[],
    prices: Price[],
    page: number = 1,
    pageSize: number = 10,
    showId: boolean = false,
  ): PaginatedTradeList {
    if (trades.length === 0) {
      return {
        page,
        pageSize,
        total: 0,
        totalPages: 0,
        trades: [this.formatEmpty()],
      };
    }

    const priceMap = new Map(prices.map(p => [p.symbol, p]));
    const activeTrades = trades.filter(t => this.isActive(t.status));
    const closedTrades = trades.filter(t => this.isClosed(t.status));

    const activeDisplay = activeTrades.map(t => this.formatTradeFull(t, priceMap.get(t.symbol), false, showId));
    const closedDisplay = closedTrades.map(t => this.formatTradeFull(t, priceMap.get(t.symbol), true, showId));

    const allTrades = [...activeDisplay, ...closedDisplay];
    const total = allTrades.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIdx = (page - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const pageTrades = allTrades.slice(startIdx, endIdx);

    const header = this.formatHeader(total, page, totalPages);
    const pagination = totalPages > 1 ? this.formatPagination(page, totalPages) : '';

    return {
      page,
      pageSize,
      total,
      totalPages,
      trades: [header, ...pageTrades, pagination].filter(Boolean),
    };
  }

  formatTradeFull(
    trade: Trade,
    price: Price | undefined,
    _compact: boolean = false,
    showId: boolean = false,
  ): string {
    const sideEmoji = trade.side === TradeSide.LONG ? '🟢' : trade.side === TradeSide.SHORT ? '🔴' : '⚪';
    const statusEmoji = this.getStatusEmoji(trade.status);
    const statusText = this.getStatusText(trade.status);

    const lines: string[] = [];

    lines.push(`${sideEmoji} ${trade.side} ${trade.symbol} ${statusEmoji} ${statusText}`);
    if (showId) {
      lines.push(`   ID: ${this.formatId(trade.id)}`);
    }

    if (trade.status === 'pending') {
      lines.push(`   @ <code>${trade.entry}</code>${trade.entryMax ? `-${trade.entryMax}` : ''}`);
      if (price) lines.push(`   Now: <code>${price.last}</code>`);
      if (trade.sl) lines.push(`   SL: <code>${trade.sl}</code>`);
      if (trade.tps) lines.push(`   TP: <code>${this.formatTps(trade.tps, trade.tpsHit)}</code>`);
    } else if (trade.status === 'active' || trade.status === 'partial_tp' || trade.status === 'breakeven') {
      const entryDisplay = trade.entryExecutedPrice
        ? `<code>${trade.entryExecutedPrice}</code> (exec)`
        : `<code>${trade.entry}</code>`;
      lines.push(`   @ ${entryDisplay}`);
      if (price) lines.push(`   Now: <code>${price.last}</code>`);
      if (trade.sl) lines.push(`   SL: <code>${trade.sl}</code>`);
      if (trade.tps) lines.push(`   TP: <code>${this.formatTps(trade.tps, trade.tpsHit)}</code>`);
      const pnl = price ? this.calculatePnl(trade, price.last) : null;
      if (pnl !== null) {
        const pnlEmoji = pnl >= 0 ? '📈' : '📉';
        lines.push(`   PnL: ${pnlEmoji} ${pnl > 0 ? '+' : ''}${pnl.toFixed(2)}R`);
      }
    } else {
      lines.push(`   @ <code>${trade.entryExecutedPrice || trade.entry}</code>`);
      if (trade.sl) lines.push(`   SL: <code>${trade.sl}</code>`);
      if (trade.tps) lines.push(`   TP: <code>${this.formatTps(trade.tps, trade.tpsHit)}</code>`);
    }

    return lines.join('\n');
  }

  private formatTps(tps: number[], tpsHit: number[]): string {
    return tps.map((tp, i) => {
      const hit = tpsHit.includes(i);
      return hit ? `✅${tp}` : tp.toString();
    }).join(' / ');
  }

  private calculatePnl(trade: Trade, currentPrice: number): number | null {
    if (!trade.entryExecutedPrice) return null;

    const entry = trade.entryExecutedPrice;
    const riskAmount = entry - (trade.sl || entry);
    if (riskAmount <= 0) return null;

    let pnl: number;
    if (trade.side === TradeSide.LONG) {
      pnl = (currentPrice - entry) / riskAmount;
    } else {
      pnl = (entry - currentPrice) / riskAmount;
    }

    return pnl;
  }

  private formatId(id: string): string {
    const shortId = id.split('-')[0];
    return `<code>${shortId}</code>`;
  }

  private formatHeader(total: number, page: number, totalPages: number): string {
    if (totalPages <= 1) {
      return `📊 <b>TRADES</b> (${total})`;
    }
    return `📊 <b>TRADES</b> (${total}) - Page ${page}/${totalPages}`;
  }

  private formatPagination(page: number, totalPages: number): string {
    const prev = page > 1 ? '◀️' : '⬛';
    const next = page < totalPages ? '▶️' : '⬛';
    return `\n${prev} Page ${page}/${totalPages} ${next}`;
  }

  private formatEmpty(): string {
    return '📊 <b>TRADES</b>\n\nNo trades yet';
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

  private getStatusText(status: TradeStatus): string {
    const textMap: Record<TradeStatus, string> = {
      pending: 'PENDING',
      active: 'ACTIVE',
      partial_tp: 'PARTIAL',
      breakeven: 'BE',
      closed_win: 'WIN',
      closed_partial: 'PARTIAL',
      closed_loss: 'LOSS',
      closed_breakeven: 'BE',
      closed_manual: 'CLOSED',
      cancelled: 'CANCELLED',
    };
    return textMap[status] || status;
  }

  private isActive(status: TradeStatus): boolean {
    return ['pending', 'active', 'partial_tp', 'breakeven'].includes(status);
  }

  private isClosed(status: TradeStatus): boolean {
    return status.startsWith('closed_');
  }

  private isNotTradeList(status: TradeStatus): boolean {
    return status === 'cancelled' || status.startsWith('closed_');
  }
}