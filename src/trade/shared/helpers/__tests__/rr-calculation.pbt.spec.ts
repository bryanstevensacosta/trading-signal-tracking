import fc from 'fast-check';
import { calculateR, calculateRR, calculatePnL } from '../rr-calculation';
import { TradeSide } from '../../types/trigger';

describe('calculateRR (property-based)', () => {
  it('RR is always >= 0 for LONG when TP > entry > SL', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.nat(),
        fc.nat(),
        (entry, sl, tp) => {
          if (entry === 0 || sl === 0 || tp === 0) return true;
          const validInput = tp > entry && entry > sl;
          if (!validInput) return true;

          const rr = calculateRR(entry, sl, tp, TradeSide.LONG);
          return rr >= 0;
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('RR is always <= 0 for SHORT when SL > entry > TP', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.nat(),
        fc.nat(),
        (entry, sl, tp) => {
          if (entry === 0 || sl === 0 || tp === 0) return true;
          const validInput = sl > entry && entry > tp;
          if (!validInput) return true;

          const rr = calculateRR(entry, sl, tp, TradeSide.SHORT);
          return rr <= 0;
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('RR magnitude equals (TP-entry)/(entry-SL)', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.nat(),
        fc.nat(),
        (entry, sl, tp) => {
          if (entry === 0 || sl === 0 || tp === 0) return true;
          const r = calculateR(entry, sl);
          if (r === 0) return true;

          const rr = calculateRR(entry, sl, tp, TradeSide.LONG);
          const expected = Math.abs(tp - entry) / r;

          return Math.abs(rr - expected) < 0.0001;
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('RR for SPOT behaves like LONG', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.nat(),
        fc.nat(),
        (entry, sl, tp) => {
          if (entry === 0 || sl === 0 || tp === 0) return true;
          const r = calculateR(entry, sl);
          if (r === 0) return true;

          const rrLong = calculateRR(entry, sl, tp, TradeSide.LONG);
          const rrSpot = calculateRR(entry, sl, tp, TradeSide.SPOT);

          return rrLong === rrSpot;
        }
      ),
      { numRuns: 500 }
    );
  });
});

describe('calculatePnL (property-based)', () => {
  it('PnL is positive for LONG when close > entry', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.nat(),
        (entry, closePrice) => {
          if (entry === 0 || closePrice === 0) return true;
          if (closePrice <= entry) return true;
          const pnl = calculatePnL(entry, closePrice, TradeSide.LONG);
          return pnl > 0;
        }
      ),
      { numRuns: 500 }
    );
  });

  it('PnL is negative for LONG when close < entry', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.nat(),
        (entry, closePrice) => {
          if (entry === 0 || closePrice === 0) return true;
          if (closePrice >= entry) return true;
          const pnl = calculatePnL(entry, closePrice, TradeSide.LONG);
          return pnl < 0;
        }
      ),
      { numRuns: 500 }
    );
  });

  it('PnL is positive for SHORT when close < entry', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.nat(),
        (entry, closePrice) => {
          if (entry === 0 || closePrice === 0) return true;
          if (closePrice >= entry) return true;
          const pnl = calculatePnL(entry, closePrice, TradeSide.SHORT);
          return pnl > 0;
        }
      ),
      { numRuns: 500 }
    );
  });

  it('PnL magnitude increases with distance', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.nat(),
        fc.nat(),
        (entry, close1, close2) => {
          if (entry === 0 || close1 === 0 || close2 === 0) return true;
          if (close1 === close2) return true;
          
          const dist1 = Math.abs(close1 - entry);
          const dist2 = Math.abs(close2 - entry);
          
          const pnl1 = Math.abs(calculatePnL(entry, close1, TradeSide.LONG));
          const pnl2 = Math.abs(calculatePnL(entry, close2, TradeSide.LONG));
          
          if (dist1 < dist2) return pnl1 < pnl2;
          if (dist1 > dist2) return pnl1 > pnl2;
          return true;
        }
      ),
      { numRuns: 500 }
    );
  });
});

describe('calculateR (property-based)', () => {
  it('R is always positive', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.nat(),
        (entry, sl) => {
          if (entry === 0 || sl === 0) return true;
          const r = calculateR(entry, sl);
          return r >= 0;
        }
      ),
      { numRuns: 500 }
    );
  });

  it('R is symmetric', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.nat(),
        (a, b) => {
          if (a === 0 || b === 0) return true;
          return calculateR(a, b) === calculateR(b, a);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('R equals 0 when entry equals SL', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        (value) => {
          if (value === 0) return true;
          return calculateR(value, value) === 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});