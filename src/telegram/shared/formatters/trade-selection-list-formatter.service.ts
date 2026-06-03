import { Injectable } from '@nestjs/common';
import { Trade, TradeStatus } from '@trade/shared';
import { formatSideEmoji, formatStatusEmoji } from '@telegram/shared/helpers';

export interface TradeListItem {
  id: string;
  symbol: string;
  side: string;
  entry: string;
  sl: string;
  tp: string;
  status: string;
  statusEmoji: string;
}

export interface PaginatedListResult {
  header: string;
  items: string[];
  navigation: { prev: string | null; next: string | null; current: number; total: number };
  hasPrev: boolean;
  hasNext: boolean;
}

const PAGE_SIZE = 5;

@Injectable()
export class TradeSelectionListFormatter {
  formatList(trades: Trade[], page: number = 1): PaginatedListResult {
    const filteredTrades = trades.filter(t =>
      t.status === TradeStatus.PENDING || t.status === TradeStatus.ACTIVE || t.status === TradeStatus.PARTIAL_TP
    );

    if (filteredTrades.length === 0) {
      return {
        header: '📊 Select Trade',
        items: ['No active or pending trades found.'],
        navigation: { prev: null, next: null, current: 1, total: 0 },
        hasPrev: false,
        hasNext: false,
      };
    }

    const total = filteredTrades.length;
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const currentPage = Math.min(Math.max(1, page), totalPages);

    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = Math.min(startIndex + PAGE_SIZE, total);
    const pageTrades = filteredTrades.slice(startIndex, endIndex);

    const items = pageTrades.map(trade => this.formatTradeItem(trade));

    return {
      header: `📊 Select Trade (${currentPage}/${totalPages})`,
      items,
      navigation: {
        prev: currentPage > 1 ? `page:${currentPage - 1}` : null,
        next: currentPage < totalPages ? `page:${currentPage + 1}` : null,
        current: currentPage,
        total: totalPages,
      },
      hasPrev: currentPage > 1,
      hasNext: currentPage < totalPages,
    };
  }

  private formatTradeItem(trade: Trade): string {
    const sideEmoji = formatSideEmoji(trade.side);
    const statusEmoji = formatStatusEmoji(trade.status);
    const statusText = this.getStatusText(trade.status);

    const entry = trade.entryExecutedPrice || trade.entry;
    const sl = trade.sl || 'N/A';
    const tp = trade.tps && trade.tps.length > 0 ? trade.tps.join(' / ') : 'N/A';

    return `${statusEmoji} ID: ${trade.id} | ${trade.symbol} | ${sideEmoji} ${trade.side} | Entry: ${entry} | SL: ${sl} | TP: ${tp} | ${statusText}`;
  }

  private getStatusText(status: TradeStatus): string {
    switch (status) {
      case TradeStatus.PENDING:
        return '⏳ PENDING';
      case TradeStatus.ACTIVE:
        return '🟢 ACTIVE';
      case TradeStatus.PARTIAL_TP:
        return '🎯 PARTIAL_TP';
      default:
        return status;
    }
  }
}