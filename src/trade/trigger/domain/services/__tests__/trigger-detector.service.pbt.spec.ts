import fc from 'fast-check';
import { TriggerDetectorService } from '../trigger-detector.service';
import { Trade, TradeStatus, TradeSide, Price, OrderType } from '@trade/shared';

describe('TriggerDetectorService (property-based)', () => {
  let service: TriggerDetectorService;

  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    service = new TriggerDetectorService(mockLogger as any);
  });

  const createTrade = (overrides: Partial<Trade> = {}): Trade => ({
    id: 'test-id',
    symbol: 'BTCUSDT',
    side: TradeSide.LONG,
    orderType: OrderType.LIMIT,
    entry: 50000,
    entryMax: null,
    entryExecutedPrice: null,
    entryExecutedAt: null,
    sl: 49000,
    tps: [52000, 54000],
    chartUrl: null,
    notes: null,
    status: TradeStatus.PENDING,
    sourceMessage: 'test',
    sourceChat: null,
    tpsHit: [],
    tradeAlertsMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
    ...overrides,
  });

  const createPrice = (overrides: Partial<Price> = {}): Price => ({
    symbol: 'BTCUSDT',
    bid: 50000,
    ask: 50001,
    last: 50000.5,
    timestamp: new Date(),
    exchange: 'binance',
    ...overrides,
  });

  describe('checkEntryHit', () => {
    it('LONG entry hit when price between entry and entryMax', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1000, max: 100000 }),
          fc.float({ min: 1000, max: 100000 }),
          fc.float({ min: 1000, max: 100000 }),
          (entry: number, entryMax: number, ask: number) => {
            if (isNaN(entry) || isNaN(entryMax) || isNaN(ask)) return true;
            if (entry === entryMax) return true;

            const maxEntry = Math.max(entry, entryMax);
            const minEntry = Math.min(entry, entryMax);

            const validAsk = Math.min(ask, maxEntry + 100);

            const trade = createTrade({
              status: TradeStatus.PENDING,
              side: TradeSide.LONG,
              entry,
              entryMax: maxEntry,
            });
            const price = createPrice({ ask: validAsk });

            const result = service.checkEntryHit(trade, price);

            if (validAsk >= entry && validAsk <= maxEntry) {
              expect(result.triggered).toBe(true);
            }
          }
        ),
        { numRuns: 500 }
      );
    });

    it('SHORT entry hit when price between entry and entryMax', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1000, max: 100000 }),
          fc.float({ min: 1000, max: 100000 }),
          fc.float({ min: 1000, max: 100000 }),
          (entry: number, entryMax: number, bid: number) => {
            const maxEntry = Math.max(entry, entryMax);
            const minEntry = Math.min(entry, entryMax);
            const validBid = Math.max(bid, minEntry - 100);

            const trade = createTrade({
              status: TradeStatus.PENDING,
              side: TradeSide.SHORT,
              entry,
              entryMax: maxEntry,
            });
            const price = createPrice({ bid: validBid });

            const result = service.checkEntryHit(trade, price);

            if (validBid <= minEntry && validBid >= maxEntry) {
              expect(result.triggered).toBe(true);
            }
          }
        ),
        { numRuns: 500 }
      );
    });

    it('entry hit returns false for non-pending trades', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(TradeStatus.ACTIVE, TradeStatus.PARTIAL_TP, TradeStatus.CLOSED_WIN),
          (status: TradeStatus) => {
            const trade = createTrade({ status });
            const price = createPrice({ ask: 50000 });

            const result = service.checkEntryHit(trade, price);

            expect(result.triggered).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('checkTPHit', () => {
    it('LONG TP hit when price >= TP', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: 1000, max: 100000 }), { minLength: 1, maxLength: 5 }),
          fc.float({ min: 1000, max: 100000 }),
          (tps: number[], bid: number) => {
            const trade = createTrade({
              status: TradeStatus.ACTIVE,
              side: TradeSide.LONG,
              tps,
            });
            const price = createPrice({ bid });

            const result = service.checkTPHit(trade, price);

            const lowestTP = Math.min(...tps);
            if (bid >= lowestTP) {
              expect(result.triggered).toBe(true);
            }
          }
        ),
        { numRuns: 500 }
      );
    });

    it('SHORT TP hit when price <= TP', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: 1000, max: 100000 }), { minLength: 1, maxLength: 5 }),
          fc.float({ min: 1000, max: 100000 }),
          (tps: number[], ask: number) => {
            const trade = createTrade({
              status: TradeStatus.ACTIVE,
              side: TradeSide.SHORT,
              tps,
            });
            const price = createPrice({ ask });

            const result = service.checkTPHit(trade, price);

            const lowestTP = Math.min(...tps);
            if (ask <= lowestTP) {
              expect(result.triggered).toBe(true);
            }
          }
        ),
        { numRuns: 500 }
      );
    });

it('already hit TPs are skipped', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: 1000, max: 100000 }), { minLength: 2, maxLength: 5 }),
          fc.nat({ max: 4 }),
          (tps: number[], hitIndex: number) => {
            const validTPs = tps.filter((tp) => !isNaN(tp));
            if (validTPs.length < 2) return true;

            const trade = createTrade({
              status: TradeStatus.ACTIVE,
              side: TradeSide.LONG,
              tps,
              tpsHit: [hitIndex],
            });
            const nextTPIndex = (hitIndex + 1) % tps.length;
            const nextTP = tps[nextTPIndex];
            if (isNaN(nextTP)) return true;
            const price = createPrice({ bid: nextTP + 10 });

            const result = service.checkTPHit(trade, price);

            if (!isNaN(nextTP) && !isNaN(tps[hitIndex])) {
              expect(result.triggered).toBe(true);
            }
            expect(result.tpIndex).not.toBe(hitIndex);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('checkSLHit', () => {
    it('LONG SL hit when price <= SL', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1000, max: 100000 }),
          fc.float({ min: 100, max: 100000 }),
          (entry: number, sl: number) => {
            if (sl >= entry || isNaN(sl) || isNaN(entry)) return true;

            const trade = createTrade({
              status: TradeStatus.ACTIVE,
              side: TradeSide.LONG,
              entry,
              sl,
            });
            const price = createPrice({ bid: sl - 1 });

            const result = service.checkSLHit(trade, price);

            expect(result.triggered).toBe(true);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('SHORT SL hit when price >= SL', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1000, max: 100000 }),
          fc.float({ min: 100, max: 100000 }),
          (entry: number, sl: number) => {
            if (sl <= entry || isNaN(sl) || isNaN(entry)) return true;

            const trade = createTrade({
              status: TradeStatus.ACTIVE,
              side: TradeSide.SHORT,
              entry,
              sl,
            });
            const price = createPrice({ ask: sl + 1 });

            const result = service.checkSLHit(trade, price);

            expect(result.triggered).toBe(true);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('no SL returns not triggered', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1000, max: 100000 }),
          (bid: number) => {
            const trade = createTrade({
              status: TradeStatus.ACTIVE,
              sl: null,
            });
            const price = createPrice({ bid });

            const result = service.checkSLHit(trade, price);

            expect(result.triggered).toBe(false);
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('checkAllTriggers - priority order', () => {
    it('entry is checked before TP', () => {
      const trade = createTrade({
        status: TradeStatus.PENDING,
        entry: 50000,
        entryMax: 50000,
        tps: [50000],
      });
      const price = createPrice({ ask: 50000, bid: 50000 });

      const result = service.checkAllTriggers(trade, price);

      expect(result.trigger).toBe('entry');
    });

    it('TP is checked before SL', () => {
      const trade = createTrade({
        status: TradeStatus.ACTIVE,
        entry: 50000,
        sl: 49000,
        tps: [52000],
      });
      const price = createPrice({ bid: 52000, ask: 52000 });

      const result = service.checkAllTriggers(trade, price);

      expect(result.trigger).toBe('tp');
    });
  });
});