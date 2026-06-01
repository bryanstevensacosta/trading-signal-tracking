import { Trade, TradeStatus } from '../../../shared/types';

export type ProfitabilityStatus = 'PROFITABLE' | 'BREAKEVEN' | 'UNPROFITABLE';

export interface TradeStatistics {
  totalTrades: number;
  closedTrades: number;
  winRate: number;
  averageRR: number;
  totalRR: number;
  breakEvenRate: number;
  profitability: ProfitabilityStatus;
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

export interface TradeSummary {
  wins: number;
  losses: number;
  total: number;
  winRate: number;
}

export interface TradeStatisticsPort {
  calculateStatistics(trades: Trade[]): Promise<TradeStatistics>;
  calculateRR(trade: Trade): CalculateRROutput | null;
  calculateTradeSummary(trades: Trade[]): TradeSummary;
  isActiveTrade(status: TradeStatus): boolean;
  isClosedTrade(status: TradeStatus): boolean;
}