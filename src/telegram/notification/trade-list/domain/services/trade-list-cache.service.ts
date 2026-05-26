import { Injectable } from '@nestjs/common';
import { Trade } from '@trade/shared';
import { TradeListCachePort, CachedTradeList } from '../ports/trade-list-cache.port';

@Injectable()
export class TradeListCacheService implements TradeListCachePort {
  private cache: Map<number, CachedTradeList> = new Map();

  set(chatId: number, messageId: number, trades: Trade[]): void {
    this.cache.set(chatId, {
      chatId,
      messageId,
      trades,
      updatedAt: new Date(),
    });
  }

  get(chatId: number): CachedTradeList | null {
    return this.cache.get(chatId) || null;
  }

  update(chatId: number, trades: Trade[]): void {
    const cached = this.cache.get(chatId);
    if (cached) {
      this.cache.set(chatId, {
        ...cached,
        trades,
        updatedAt: new Date(),
      });
    }
  }

  delete(chatId: number): void {
    this.cache.delete(chatId);
  }

  has(chatId: number): boolean {
    return this.cache.has(chatId);
  }

  getAll(): CachedTradeList[] {
    return Array.from(this.cache.values());
  }
}