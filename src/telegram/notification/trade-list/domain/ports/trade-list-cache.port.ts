import { Trade } from '@trade/shared';

export interface CachedTradeList {
  chatId: number;
  messageId: number;
  trades: Trade[];
  updatedAt: Date;
}

export interface TradeListCachePort {
  set(chatId: number, messageId: number, trades: Trade[]): void;
  get(chatId: number): CachedTradeList | null;
  update(chatId: number, trades: Trade[]): void;
  delete(chatId: number): void;
  has(chatId: number): boolean;
}