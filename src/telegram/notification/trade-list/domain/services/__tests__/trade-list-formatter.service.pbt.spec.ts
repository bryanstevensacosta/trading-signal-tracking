import fc from 'fast-check';
import { TradeListFormatterService } from '../trade-list-formatter.service';
import { Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared';

describe('TradeListFormatterService (property-based)', () => {
  let formatter: TradeListFormatterService;

  beforeEach(() => {
    formatter = new TradeListFormatterService();
  });

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
      status: fc.constantFrom(
        TradeStatus.PENDING,
        TradeStatus.ACTIVE,
        TradeStatus.PARTIAL_TP,
        TradeStatus.BREAKEVEN,
        TradeStatus.CLOSED_WIN,
        TradeStatus.CLOSED_PARTIAL,
        TradeStatus.CLOSED_LOSS,
        TradeStatus.CLOSED_BREAKEVEN,
        TradeStatus.CLOSED_MANUAL,
        TradeStatus.CANCELLED,
      ),
      sourceMessage: fc.string(),
      sourceChat: fc.oneof(fc.constant(null), fc.integer()),
      tpsHit: fc.array(fc.integer({ min: 0 })),
      notificationMessageId: fc.oneof(fc.constant(null), fc.integer()),
      createdAt: fc.date(),
      updatedAt: fc.date(),
      closedAt: fc.oneof(fc.constant(null), fc.date()),
    });

  it('should always return a string', () => {
    fc.assert(
      fc.property(fc.array(createTradeArb()), (trades) => {
        const result = formatter.format(trades);
        return typeof result === 'string' && result.length > 0;
      }),
      { numRuns: 50 }
    );
  });

  it('should contain header in every output', () => {
    fc.assert(
      fc.property(fc.array(createTradeArb()), (trades) => {
        const result = formatter.format(trades);
        return result.includes('TRADES');
      }),
      { numRuns: 50 }
    );
  });

  it('should show "No trades yet" only for empty array', () => {
    const result = formatter.format([]);
    expect(result).toContain('No trades yet');

    fc.assert(
      fc.property(fc.array(createTradeArb(), { minLength: 1 }), (trades) => {
        const result = formatter.format(trades);
        return !result.includes('No trades yet');
      }),
      { numRuns: 50 }
    );
  });

  it('should contain Summary section when there are trades', () => {
    fc.assert(
      fc.property(fc.array(createTradeArb(), { minLength: 1 }), (trades) => {
        const result = formatter.format(trades);
        return result.includes('Summary:');
      }),
      { numRuns: 50 }
    );
  });

  it('should always contain "WR" in summary when there are trades', () => {
    fc.assert(
      fc.property(fc.array(createTradeArb(), { minLength: 1 }), (trades) => {
        const result = formatter.format(trades);
        return result.includes('% WR');
      }),
      { numRuns: 50 }
    );
  });
});