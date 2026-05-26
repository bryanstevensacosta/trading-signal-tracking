import { Inject, Injectable } from '@nestjs/common';
import { Trade, ClosedTradeStatus, TradeStatus } from '../../../shared/types';
import { TradeHistoryPort, HistoryFilters } from '../../domain/ports/trade-history.port';
import { TRADE_REPOSITORY_PORT, TradeRepositoryPort } from '../../../repository/domain/ports/trade-repository.port';

@Injectable()
export class TradeHistoryAdapter implements TradeHistoryPort {
  private readonly CLOSED_STATUSES: ClosedTradeStatus[] = [
    TradeStatus.CLOSED_WIN,
    TradeStatus.CLOSED_PARTIAL,
    TradeStatus.CLOSED_LOSS,
    TradeStatus.CLOSED_BREAKEVEN,
    TradeStatus.CLOSED_MANUAL,
  ];

  constructor(
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
  ) {}

  async findClosed(filters?: HistoryFilters): Promise<Trade[]> {
    const allTrades = await this.repository.findAll();
    let closedTrades = allTrades.filter((t) => this.isClosedTrade(t.status));

    if (filters) {
      closedTrades = this.applyFilters(closedTrades, filters);
    }

    closedTrades.sort((a, b) => {
      const dateA = a.closedAt || a.createdAt;
      const dateB = b.closedAt || b.createdAt;
      return dateB.getTime() - dateA.getTime();
    });

    if (filters?.offset) {
      closedTrades = closedTrades.slice(filters.offset);
    }

    if (filters?.limit) {
      closedTrades = closedTrades.slice(0, filters.limit);
    }

    return closedTrades;
  }

  async findHistory(filters?: HistoryFilters): Promise<Trade[]> {
    const allTrades = await this.repository.findAll();
    let historyTrades = allTrades.filter((t) => t.status !== 'pending');

    if (filters) {
      historyTrades = this.applyFilters(historyTrades, filters);
    }

    historyTrades.sort((a, b) => {
      const dateA = a.closedAt || a.createdAt;
      const dateB = b.closedAt || b.createdAt;
      return dateB.getTime() - dateA.getTime();
    });

    if (filters?.offset) {
      historyTrades = historyTrades.slice(filters.offset);
    }

    if (filters?.limit) {
      historyTrades = historyTrades.slice(0, filters.limit);
    }

    return historyTrades;
  }

  async findById(id: string): Promise<Trade | null> {
    const trade = await this.repository.findById(id);
    if (trade && this.isClosedTrade(trade.status)) {
      return trade;
    }
    return null;
  }

  async count(filters?: HistoryFilters): Promise<number> {
    const closedTrades = await this.findClosed(filters);
    return closedTrades.length;
  }

  private isClosedTrade(status: TradeStatus): boolean {
    return this.CLOSED_STATUSES.includes(status as ClosedTradeStatus) || status === TradeStatus.CANCELLED;
  }

  private applyFilters(trades: Trade[], filters: HistoryFilters): Trade[] {
    return trades.filter((trade) => {
      if (filters.symbols?.length && !filters.symbols.includes(trade.symbol)) {
        return false;
      }

      if (filters.sides?.length && !filters.sides.includes(trade.side)) {
        return false;
      }

      if (filters.statuses?.length && !filters.statuses.includes(trade.status as ClosedTradeStatus)) {
        return false;
      }

      if (filters.fromDate) {
        const tradeDate = trade.closedAt || trade.createdAt;
        if (tradeDate < filters.fromDate) {
          return false;
        }
      }

      if (filters.toDate) {
        const tradeDate = trade.closedAt || trade.createdAt;
        if (tradeDate > filters.toDate) {
          return false;
        }
      }

      return true;
    });
  }
}