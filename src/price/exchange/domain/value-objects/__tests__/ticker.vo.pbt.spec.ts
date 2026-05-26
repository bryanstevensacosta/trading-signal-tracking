import fc from 'fast-check';
import { createTicker } from '../ticker.vo';

describe('createTicker (property-based)', () => {
  it('should always produce uppercase symbol', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2, maxLength: 10 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (symbol, volume) => {
          const ticker = createTicker({ volume }, symbol);
          return ticker.symbol === ticker.symbol.toUpperCase();
        }
      ),
      { numRuns: 500 }
    );
  });

  it('should always produce non-negative bid, ask, and last', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, noNaN: true }),
        fc.float({ min: 0, noNaN: true }),
        fc.float({ min: 0, noNaN: true }),
        (bid, ask, last) => {
          const ticker = createTicker({
            bidPrice: bid.toString(),
            askPrice: ask.toString(),
            lastPrice: last.toString(),
          }, 'BTCUSDT');
          return ticker.bid >= 0 && ticker.ask >= 0 && ticker.last >= 0;
        }
      ),
      { numRuns: 500 }
    );
  });

  it('should always produce valid timestamp', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        (closeTime) => {
          const ticker = createTicker({ closeTime }, 'BTCUSDT');
          return ticker.timestamp instanceof Date && !isNaN(ticker.timestamp.getTime());
        }
      ),
      { numRuns: 200 }
    );
  });

  it('should parse string numbers correctly', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1e10, noNaN: true, noDefaultInfinity: true }),
        (value) => {
          const ticker = createTicker({
            bidPrice: value.toFixed(2),
            askPrice: value.toFixed(2),
            lastPrice: value.toFixed(2),
          }, 'BTCUSDT');
          return Math.abs(ticker.bid - value) < 0.01;
        }
      ),
      { numRuns: 500 }
    );
  });

  it('should handle empty string values', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', '0', '0.0', '0.00'),
        (value) => {
          const ticker = createTicker({ bidPrice: value }, 'BTCUSDT');
          return ticker.bid === 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});