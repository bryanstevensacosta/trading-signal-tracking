import { TradeListCacheService } from '../trade-list-cache.service';
import { Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared';

describe('TradeListCacheService', () => {
  let cache: TradeListCacheService;

  const createTrade = (symbol: string = 'BTCUSDT'): Trade => ({
    id: '1',
    symbol,
    side: TradeSide.LONG,
    orderType: OrderType.LIMIT,
    entry: 50000,
    entryMax: null,
    entryExecutedPrice: null,
    entryExecutedAt: null,
    sl: 49000,
    tps: [52000],
    chartUrl: null,
    notes: null,
    status: TradeStatus.PENDING,
    sourceMessage: '',
    sourceChat: null,
    tpsHit: [],
    tradeAlertsMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
  });

  beforeEach(() => {
    cache = new TradeListCacheService();
  });

  describe('set and get', () => {
    it('should store and retrieve cached trade list', () => {
      const chatId = 12345;
      const messageId = 100;
      const trades = [createTrade('BTCUSDT'), createTrade('ETHUSDT')];

      cache.set(chatId, messageId, trades);
      const result = cache.get(chatId);

      expect(result).not.toBeNull();
      expect(result!.chatId).toBe(chatId);
      expect(result!.messageId).toBe(messageId);
      expect(result!.trades).toHaveLength(2);
    });

    it('should return null for non-existent chatId', () => {
      const result = cache.get(99999);

      expect(result).toBeNull();
    });

    it('should include updatedAt timestamp', () => {
      const chatId = 12345;
      const before = new Date();
      cache.set(chatId, 100, []);

      const result = cache.get(chatId);

      expect(result!.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('update', () => {
    it('should update trades for existing chat', () => {
      const chatId = 12345;
      cache.set(chatId, 100, [createTrade('BTCUSDT')]);

      cache.update(chatId, [createTrade('ETHUSDT'), createTrade('BNBUSDT')]);

      const result = cache.get(chatId);
      expect(result!.trades).toHaveLength(2);
      expect(result!.trades[0].symbol).toBe('ETHUSDT');
    });

    it('should not create new entry if chatId does not exist', () => {
      cache.update(99999, [createTrade()]);

      expect(cache.get(99999)).toBeNull();
    });

    it('should update timestamp on update', async () => {
      const chatId = 12345;
      cache.set(chatId, 100, []);

      await new Promise(resolve => setTimeout(resolve, 10));
      cache.update(chatId, []);

      const result = cache.get(chatId);
      expect(result!.updatedAt.getTime()).toBeGreaterThan(result!.updatedAt.getTime() - 1000);
    });
  });

  describe('delete', () => {
    it('should remove cached entry', () => {
      const chatId = 12345;
      cache.set(chatId, 100, []);

      cache.delete(chatId);

      expect(cache.get(chatId)).toBeNull();
    });

    it('should not throw when deleting non-existent entry', () => {
      expect(() => cache.delete(99999)).not.toThrow();
    });
  });

  describe('has', () => {
    it('should return true for existing chatId', () => {
      const chatId = 12345;
      cache.set(chatId, 100, []);

      expect(cache.has(chatId)).toBe(true);
    });

    it('should return false for non-existent chatId', () => {
      expect(cache.has(99999)).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return all cached entries', () => {
      cache.set(111, 100, [createTrade('BTCUSDT')]);
      cache.set(222, 200, [createTrade('ETHUSDT')]);
      cache.set(333, 300, [createTrade('BNBUSDT')]);

      const result = cache.getAll();

      expect(result).toHaveLength(3);
    });

    it('should return empty array when no entries', () => {
      const result = cache.getAll();

      expect(result).toHaveLength(0);
    });
  });
});