import fc from 'fast-check';
import { TradeAlertService } from '../trade-alert.service';
import { Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared/types';

describe('TradeAlertService (property-based)', () => {
  let service: TradeAlertService;

  beforeEach(() => {
    service = new TradeAlertService();
  });

  describe('formatEntryTriggered', () => {
    it('should always contain the symbol', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.constantFrom(TradeSide.LONG, TradeSide.SHORT, TradeSide.SPOT),
          fc.nat(),
          fc.nat(),
          (symbol, side, entry, sl) => {
            const trade = createTrade({ symbol: symbol.toUpperCase(), side, entry, sl });
            const result = service.formatEntryTriggered(trade);
            return result.includes(symbol.toUpperCase());
          }
        ),
        { numRuns: 500 }
      );
    });

    it('should contain correct label for each side', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(TradeSide.LONG, TradeSide.SHORT, TradeSide.SPOT),
          (side) => {
            const trade = createTrade({ side });
            const result = service.formatEntryTriggered(trade);
            const expectedLabel = side === TradeSide.LONG ? 'FUTURES LONG' : side === TradeSide.SHORT ? 'FUTURES SHORT' : 'SPOT BUY';
            return result.includes(expectedLabel);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('formatTPHit', () => {
    it('should always contain TP number', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.array(fc.nat(), { maxLength: 5 }),
          fc.integer({ min: 0, max: 10 }),
          fc.float(),
          (symbol, tps, tpIndex, rr) => {
            if (tps.length === 0) return true;
            const adjustedIndex = tpIndex % tps.length;
            const trade = createTrade({ symbol, tps });
            const result = service.formatTPHit(trade, adjustedIndex, rr);
            return result.includes(`TP${adjustedIndex + 1} HIT`);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('should format RR with 1 decimal place', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -10, max: 10 }),
          (rr) => {
            const trade = createTrade({ tps: [52000] });
            const result = service.formatTPHit(trade, 0, rr);
            return result.includes(`${rr.toFixed(1)}R`);
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('formatSLHit', () => {
    it('should always contain SL HIT', () => {
      fc.assert(
        fc.property(fc.string(), fc.float(), (symbol, rr) => {
          const trade = createTrade({ symbol });
          const result = service.formatSLHit(trade, rr);
          return result.includes('SL HIT');
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('formatTradeCreated', () => {
    it('should include side in message', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(TradeSide.LONG, TradeSide.SHORT, TradeSide.SPOT),
          (side) => {
            const trade = createTrade({ side });
            const result = service.formatTradeCreated(trade);
            return result.includes(`Side: ${side}`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include entry price', () => {
      fc.assert(
        fc.property(fc.nat(), (entry) => {
          const trade = createTrade({ entry });
          const result = service.formatTradeCreated(trade);
          return result.includes(`Entry: ${entry}`);
        }),
        { numRuns: 200 }
      );
    });
  });

describe('formatModification', () => {
    it('should include field, old and new values in output', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.oneof(fc.string({ minLength: 1 }), fc.integer(), fc.float()),
          fc.oneof(fc.string({ minLength: 1 }), fc.integer(), fc.float()),
          (field, oldVal, newVal) => {
            const trade = createTrade({});
            const result = service.formatModification(trade, field, oldVal, newVal);
            const oldStr = String(oldVal).trim();
            const newStr = String(newVal).trim();
            const fieldTrimmed = field.trim();
            return result.includes(fieldTrimmed) && result.includes(oldStr) && result.includes(newStr);
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('formatBreakeven', () => {
    it('should always contain BREAKEVEN text', () => {
      fc.assert(
        fc.property(fc.string(), (symbol) => {
          const trade = createTrade({ symbol });
          const result = service.formatBreakeven(trade);
          return result.includes('BREAKEVEN');
        }),
        { numRuns: 100 }
      );
    });
  });
});

function createTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 'test-id',
    symbol: 'BTCUSDT',
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
    sourceMessage: 'test message',
    sourceChat: null,
    tpsHit: [],
    tradeAlertsMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
    ...overrides,
  };
}