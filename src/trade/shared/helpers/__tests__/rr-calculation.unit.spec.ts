import { calculateR, calculateRR, calculateMultipleRR, calculatePnL, calculatePnLPercent } from '../rr-calculation';
import { TradeSide } from '../../types/trigger';

describe('calculateR', () => {
  it('should return absolute difference between entry and SL', () => {
    expect(calculateR(50000, 49000)).toBe(1000);
    expect(calculateR(50000, 51000)).toBe(1000);
  });

  it('should return 0 when entry equals SL', () => {
    expect(calculateR(50000, 50000)).toBe(0);
  });
});

describe('calculateRR', () => {
  describe('LONG trades', () => {
    it('should calculate positive RR when TP > entry > SL', () => {
      const rr = calculateRR(50000, 49000, 52000, TradeSide.LONG);
      expect(rr).toBe(2);
    });

    it('should calculate RR of 1 when TP - entry = entry - SL', () => {
      const rr = calculateRR(50000, 49000, 51000, TradeSide.LONG);
      expect(rr).toBe(1);
    });

    it('should return 0 when SL equals entry', () => {
      const rr = calculateRR(50000, 50000, 52000, TradeSide.LONG);
      expect(rr).toBe(0);
    });
  });

  describe('SHORT trades', () => {
    it('should calculate negative RR when SL > entry > TP', () => {
      const rr = calculateRR(50000, 51000, 49000, TradeSide.SHORT);
      expect(rr).toBe(-1);
    });

    it('should return 0 when SL equals entry', () => {
      const rr = calculateRR(50000, 50000, 49000, TradeSide.SHORT);
      expect(rr).toBe(0);
    });
  });

  describe('SPOT trades', () => {
    it('should calculate positive RR like LONG', () => {
      const rr = calculateRR(50000, 49000, 52000, TradeSide.SPOT);
      expect(rr).toBe(2);
    });
  });
});

describe('calculateMultipleRR', () => {
  it('should calculate RR for multiple TPs', () => {
    const rrs = calculateMultipleRR(50000, 49000, [51000, 52000, 53000], TradeSide.LONG);
    expect(rrs).toEqual([1, 2, 3]);
  });

  it('should return empty array when no TPs provided', () => {
    const rrs = calculateMultipleRR(50000, 49000, [], TradeSide.LONG);
    expect(rrs).toEqual([]);
  });
});

describe('calculatePnL', () => {
  describe('LONG trades', () => {
    it('should return positive PnL when close > entry', () => {
      expect(calculatePnL(50000, 52000, TradeSide.LONG)).toBe(2000);
    });

    it('should return negative PnL when close < entry', () => {
      expect(calculatePnL(50000, 48000, TradeSide.LONG)).toBe(-2000);
    });

    it('should return 0 when close equals entry', () => {
      expect(calculatePnL(50000, 50000, TradeSide.LONG)).toBe(0);
    });
  });

  describe('SHORT trades', () => {
    it('should return positive PnL when close < entry', () => {
      expect(calculatePnL(50000, 48000, TradeSide.SHORT)).toBe(2000);
    });

    it('should return negative PnL when close > entry', () => {
      expect(calculatePnL(50000, 52000, TradeSide.SHORT)).toBe(-2000);
    });

    it('should return 0 when close equals entry', () => {
      expect(calculatePnL(50000, 50000, TradeSide.SHORT)).toBe(0);
    });
  });

  describe('SPOT trades', () => {
    it('should behave like LONG', () => {
      expect(calculatePnL(50000, 52000, TradeSide.SPOT)).toBe(2000);
    });
  });
});

describe('calculatePnLPercent', () => {
  it('should calculate percentage PnL', () => {
    expect(calculatePnLPercent(50000, 55000, TradeSide.LONG)).toBe(10);
  });

  it('should return negative for loss', () => {
    expect(calculatePnLPercent(50000, 45000, TradeSide.LONG)).toBe(-10);
  });

  it('should return 0 for breakeven', () => {
    expect(calculatePnLPercent(50000, 50000, TradeSide.LONG)).toBe(0);
  });
});