import { Inject, Injectable } from '@nestjs/common';
import { Trade } from '../../../shared/types';
import { TRADE_HISTORY_PORT, TradeHistoryPort, HistoryFilters } from '../ports/trade-history.port';

@Injectable()
export class TradeHistoryService {
  constructor(
    @Inject(TRADE_HISTORY_PORT) private readonly historyPort: TradeHistoryPort,
  ) {}

  async findClosedTrades(filters?: HistoryFilters): Promise<Trade[]> {
    return this.historyPort.findClosed(filters);
  }

  async findHistoryTrades(filters?: HistoryFilters): Promise<Trade[]> {
    return this.historyPort.findHistory(filters);
  }

  async getTradeById(id: string): Promise<Trade | null> {
    return this.historyPort.findById(id);
  }

  async getClosedTradesCount(filters?: HistoryFilters): Promise<number> {
    return this.historyPort.count(filters);
  }

  async getClosedTradesBySymbols(symbols: string[], limit?: number): Promise<Trade[]> {
    return this.historyPort.findClosed({ symbols, limit });
  }

  async getRecentClosedTrades(limit: number = 10): Promise<Trade[]> {
    return this.historyPort.findClosed({ limit });
  }

  async getClosedTradesByDateRange(from: Date, to: Date): Promise<Trade[]> {
    return this.historyPort.findClosed({ fromDate: from, toDate: to });
  }
}