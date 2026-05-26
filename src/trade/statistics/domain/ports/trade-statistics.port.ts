import { Trade } from '../../../shared/types';

export interface TradeStatistics {
  totalTrades: number;
  closedTrades: number;
  winRate: number;
  averageRR: number;
  bestTrade: { symbol: string; rr: number; pnl: number; closedAt: Date } | null;
  worstTrade: { symbol: string; rr: number; pnl: number; closedAt: Date } | null;
  tradesThisWeek: number;
  tradesThisMonth: number;
  tradesThisYear: number;
  winsBySymbol: Record<string, number>;
  lossesBySymbol: Record<string, number>;
}

export interface CalculateRROutput {
  rr: number;
  pnl: number;
}

export interface TradeStatisticsPort {
  calculateStatistics(trades: Trade[]): Promise<TradeStatistics>;
  calculateRR(trade: Trade): CalculateRROutput | null;
}