import { Injectable } from '@nestjs/common';
import { Trade, TradeStatus, Price } from '@trade/shared';
import { formatSideEmoji, formatTps } from '@telegram/shared/helpers';
import { TradeSide } from '@trade/shared';
import { getTelegramConfig } from '@config/telegram.config';

const ACTIVE_STATUSES = [TradeStatus.PENDING, TradeStatus.ACTIVE, TradeStatus.PARTIAL_TP];

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
export class TradeListService {
  formatTradeList(
    trades: Trade[],
    prices: Price[],
    page: number = 1,
    pageSize: number = 10,
    includeTradeId: boolean = false,
  ): PaginatedTradeList {
    const priceMap = new Map(prices.map(p => [p.symbol, p]));

    const filteredTrades = trades.filter(t => ACTIVE_STATUSES.includes(t.status));

    if (filteredTrades.length === 0) {
      return {
        page,
        pageSize,
        total: 0,
        totalPages: 0,
        trades: [this.formatEmpty()],
      };
    }

    const pendingTrades = filteredTrades.filter(t => t.status === TradeStatus.PENDING);
    const activeTrades = filteredTrades.filter(t => t.status === TradeStatus.ACTIVE || t.status === TradeStatus.PARTIAL_TP);

    const pendingDisplay = pendingTrades.map(t => this.formatTradeSegment(t, priceMap.get(t.symbol), includeTradeId));
    const activeDisplay = activeTrades.map(t => this.formatTradeSegment(t, priceMap.get(t.symbol), includeTradeId));

    const total = filteredTrades.length;
    const totalPages = Math.ceil(total / pageSize);

    const lines: string[] = [];
    lines.push(`📊 <b>TRADES</b> (${total})`);
    lines.push('');

    if (pendingDisplay.length > 0) {
      lines.push('<b>PENDING</b>');
      lines.push(...pendingDisplay);
    } else {
      lines.push('<b>PENDING</b>');
      lines.push('N/A');
    }

    lines.push('');
    lines.push('---');
    lines.push('');

    if (activeDisplay.length > 0) {
      lines.push('<b>ACTIVE</b>');
      lines.push(...activeDisplay);
    } else {
      lines.push('<b>ACTIVE</b>');
      lines.push('N/A');
    }

    return {
      page,
      pageSize,
      total,
      totalPages,
      trades: lines.filter(Boolean),
    };
  }

  formatTradeSegment(
    trade: Trade,
    price: Price | undefined,
    includeTradeId: boolean = false,
  ): string {
    const sideEmoji = formatSideEmoji(trade.side);
    const tradeAlertsMessageId = trade.tradeAlertsMessageId;
    const telegramConfig = getTelegramConfig();

    const headerLink = tradeAlertsMessageId && telegramConfig.groupId && telegramConfig.tradeAlertsThreadId
      ? `<a href="https://t.me/c/${telegramConfig.groupId.toString().replace('-100', '')}/${telegramConfig.tradeAlertsThreadId}/${tradeAlertsMessageId}">${sideEmoji} ${trade.side} ${trade.symbol}</a>`
      : `${sideEmoji} ${trade.side} ${trade.symbol}`;

    const statusText = this.formatStatusText(trade);

    const lines: string[] = [];
    lines.push(headerLink);

    if (includeTradeId) {
      lines.push(`<b>ID:</b> <code>${trade.id}</code>`);
    }

    lines.push(`<b>STATUS:</b> ${statusText}`);

    const entryValue = trade.entryExecutedPrice || trade.entry;
    lines.push(`<b>ENTRY:</b> <code>${entryValue}</code>`);

    if (price) {
      lines.push(`<b>NOW:</b> <code>${price.last}</code>`);
    }

    if (trade.sl) {
      lines.push(`<b>SL:</b> <code>${trade.sl}</code>`);
    }

    if (trade.tps && trade.tps.length > 0) {
      const tpDisplay = formatTps(trade.tps, trade.tpsHit);
      lines.push(`<b>TP:</b> <code>${tpDisplay}</code>`);
    }

    const rr = this.calculateRR(trade);
    if (rr !== null) {
      lines.push(`<b>RR:</b> <code>${rr.toFixed(2)}R</code>`);
    } else {
      lines.push(`<b>RR:</b> <code>N/A</code>`);
    }

    return lines.join('\n');
  }

  private formatStatusText(trade: Trade): string {
    if (trade.status === TradeStatus.PENDING) {
      return 'WAITING FOR ENTRY';
    }

    if (trade.status === TradeStatus.PARTIAL_TP && trade.tpsHit) {
      const lastTpIndex = trade.tpsHit[trade.tpsHit.length - 1];
      return `HIT TP${lastTpIndex + 2}`;
    }

    if (trade.status === TradeStatus.ACTIVE) {
      return 'WAITING FOR TP/SL';
    }

    if (trade.status === TradeStatus.BREAKEVEN) {
      return 'AT BREAKEVEN';
    }

    return trade.status.toUpperCase();
  }

  private calculateRR(trade: Trade): number | null {
    if (!trade.sl || !trade.entryExecutedPrice || !trade.tps?.length) {
      return null;
    }

    let tp: number;
    if (trade.tpsHit && trade.tpsHit.length > 0) {
      const lastTpIndex = trade.tpsHit[trade.tpsHit.length - 1];
      tp = trade.tps[lastTpIndex];
    } else if (trade.status === 'closed_win' || trade.status === 'closed_partial') {
      tp = trade.tps[trade.tps.length - 1];
    } else {
      return null;
    }

    if (!tp) return null;

    const risk = Math.abs(trade.entryExecutedPrice - trade.sl);
    if (risk === 0) return null;

    const reward = trade.side === TradeSide.LONG
      ? tp - trade.entryExecutedPrice
      : trade.entryExecutedPrice - tp;

    return reward / risk;
  }

  private formatEmpty(): string {
    return '📊 <b>TRADES</b>\n\nNo trades yet';
  }

  private isNotTradeList(status: TradeStatus): boolean {
    return status === 'cancelled' || status.startsWith('closed_');
  }
}
