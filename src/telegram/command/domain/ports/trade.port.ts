export const TRADE_PORT_TOKEN = 'TRADE_PORT';

export interface TradePort {
  findById(id: string): Promise<import('@trade/shared').Trade | null>;
  findAll(): Promise<import('@trade/shared').Trade[]>;
  findActive(): Promise<import('@trade/shared').Trade[]>;
  findPending(): Promise<import('@trade/shared').Trade[]>;
  update(id: string, input: unknown): Promise<import('@trade/shared').Trade | null>;
  delete(id: string): Promise<boolean>;
  deleteAll(): Promise<number>;
}

export interface TradeStats {
  totalTrades: number;
  winRate: number;
  averageRR: number;
  bestTrade: number;
  worstTrade: number;
  tradesThisWeek: number;
  tradesThisMonth: number;
}