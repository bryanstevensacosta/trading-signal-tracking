import { Trade, ClosedTradeStatus, TradeSide } from '../../../shared/types';

export const TRADE_HISTORY_PORT = 'TRADE_HISTORY_PORT';

export interface HistoryFilters {
  symbols?: string[];
  sides?: TradeSide[];
  statuses?: ClosedTradeStatus[];
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

export interface TradeHistoryPort {
  findClosed(filters?: HistoryFilters): Promise<Trade[]>;
  findHistory(filters?: HistoryFilters): Promise<Trade[]>;
  findById(id: string): Promise<Trade | null>;
  count(filters?: HistoryFilters): Promise<number>;
}