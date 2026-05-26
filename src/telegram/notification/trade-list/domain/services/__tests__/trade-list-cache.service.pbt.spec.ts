import fc from 'fast-check';
import { TradeListCacheService } from '../trade-list-cache.service';
import { Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared';

describe('TradeListCacheService (property-based)', () => {
  let cache: TradeListCacheService;

  const createTradeArb = (): fc.Arbitrary<Trade> =>
    fc.record({
      id: fc.string({ minLength: 1 }),
      symbol: fc.string({ minLength: 1, maxLength: 10 }),
      side: fc.constantFrom(TradeSide.LONG, TradeSide.SHORT, TradeSide.SPOT),
      orderType: fc.constantFrom(OrderType.LIMIT, OrderType.MARKET),
      entry: fc.integer({ min: 100, max: 100000 }),
      entryMax: fc.oneof(fc.constant(null), fc.integer({ min: 100, max: 100000 })),
      entryExecutedPrice: fc.oneof(fc.constant(null), fc.integer({ min: 100, max: 100000 })),
      entryExecutedAt: fc.oneof(fc.constant(null), fc.date()),
      sl: fc.oneof(fc.constant(null), fc.integer({ min: 100, max: 100000 })),
      tps: fc.oneof(fc.constant(null), fc.array(fc.integer({ min: 100, max: 100000 }), { minLength: 1, maxLength: 5 })),
      chartUrl: fc.oneof(fc.constant(null), fc.string()),
      notes: fc.oneof(fc.constant(null), fc.string()),
      status: fc.constantFrom(TradeStatus.PENDING, TradeStatus.ACTIVE, TradeStatus.CLOSED_WIN),
      sourceMessage: fc.string(),
      sourceChat: fc.oneof(fc.constant(null), fc.integer()),
      tpsHit: fc.array(fc.integer({ min: 0 })),
      notificationMessageId: fc.oneof(fc.constant(null), fc.integer()),
      createdAt: fc.date(),
      updatedAt: fc.date(),
      closedAt: fc.oneof(fc.constant(null), fc.date()),
    });

  beforeEach(() => {
    cache = new TradeListCacheService();
  });

  it('should always return null for non-existent chatId', () => {
    fc.assert(
      fc.property(fc.integer(), (chatId) => {
        const result = cache.get(chatId);
        return result === null;
      }),
      { numRuns: 100 }
    );
  });

  it('has should be consistent with get', () => {
    fc.assert(
      fc.property(fc.integer(), (chatId) => {
        const hasResult = cache.has(chatId);
        const getResult = cache.get(chatId);
        return hasResult === (getResult !== null);
      }),
      { numRuns: 100 }
    );
  });

  it('set and get should be consistent', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1 }),
        fc.integer({ min: 1 }),
        fc.array(createTradeArb()),
        (chatId, messageId, trades) => {
          cache.set(chatId, messageId, trades);
          const result = cache.get(chatId);
          return (
            result !== null &&
            result.chatId === chatId &&
            result.messageId === messageId &&
            result.trades === trades
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('delete should remove entry', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1 }),
        fc.integer({ min: 1 }),
        fc.array(createTradeArb()),
        (chatId, messageId, trades) => {
          cache.set(chatId, messageId, trades);
          cache.delete(chatId);
          return cache.get(chatId) === null && !cache.has(chatId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('update should not change messageId', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1 }),
        fc.integer({ min: 1 }),
        fc.array(createTradeArb()),
        fc.array(createTradeArb()),
        (chatId, messageId, trades1, trades2) => {
          if (trades1.length === 0 || trades2.length === 0) return true;

          cache.set(chatId, messageId, trades1);
          cache.update(chatId, trades2);
          const result = cache.get(chatId);

          return result !== null && result.messageId === messageId;
        }
      ),
      { numRuns: 100 }
    );
  });
});