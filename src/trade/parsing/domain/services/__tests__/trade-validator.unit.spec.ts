import { TradeValidator, ValidationResult } from '../trade-validator';
import { TradeSide } from '@trade/shared';

describe('TradeValidator', () => {
  let validator: TradeValidator;

  beforeEach(() => {
    validator = new TradeValidator();
  });

  describe('validateSymbol', () => {
    it('should return valid for USDT symbol', () => {
      const result = validator.validateSymbol('BTCUSDT');
      expect(result.valid).toBe(true);
    });

    it('should return valid for USD symbol', () => {
      const result = validator.validateSymbol('BTCUSD');
      expect(result.valid).toBe(true);
    });

    it('should return valid for BTC symbol', () => {
      const result = validator.validateSymbol('BTCBTC');
      expect(result.valid).toBe(true);
    });

    it('should return valid for ETH symbol', () => {
      const result = validator.validateSymbol('ETHETH');
      expect(result.valid).toBe(true);
    });

    it('should return invalid for null symbol', () => {
      const result = validator.validateSymbol(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Symbol is required');
    });

    it('should return invalid for symbol without valid pair', () => {
      const result = validator.validateSymbol('INVALID');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Symbol must end with USDT, USD, BTC, or ETH');
    });

    it('should be case insensitive', () => {
      const result = validator.validateSymbol('btcusdt');
      expect(result.valid).toBe(true);
    });
  });

  describe('validateEntry', () => {
    it('should return valid for positive entry', () => {
      const result = validator.validateEntry(50000);
      expect(result.valid).toBe(true);
    });

    it('should return invalid for null entry', () => {
      const result = validator.validateEntry(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Entry price is required');
    });

    it('should return invalid for zero entry', () => {
      const result = validator.validateEntry(0);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Entry price must be positive');
    });

    it('should return invalid for negative entry', () => {
      const result = validator.validateEntry(-100);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateSL', () => {
    it('should return valid for null SL (optional)', () => {
      const result = validator.validateSL(50000, null);
      expect(result.valid).toBe(true);
    });

    it('should return valid for positive SL', () => {
      const result = validator.validateSL(50000, 49000);
      expect(result.valid).toBe(true);
    });

    it('should return invalid for negative SL', () => {
      const result = validator.validateSL(50000, -100);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('SL must be positive');
    });
  });

  describe('validateTPs', () => {
    it('should return valid for null TPs (optional)', () => {
      const result = validator.validateTPs(50000, null);
      expect(result.valid).toBe(true);
    });

    it('should return valid for empty TPs', () => {
      const result = validator.validateTPs(50000, []);
      expect(result.valid).toBe(true);
    });

    it('should return valid for positive TPs', () => {
      const result = validator.validateTPs(50000, [52000, 53000]);
      expect(result.valid).toBe(true);
    });

    it('should return invalid for negative TP', () => {
      const result = validator.validateTPs(50000, [-100]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('TP1 must be positive');
    });

    it('should return invalid for zero TP', () => {
      const result = validator.validateTPs(50000, [0]);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateTrade', () => {
    it('should return valid for complete LONG trade', () => {
      const result = validator.validateTrade(
        'BTCUSDT',
        TradeSide.LONG,
        50000,
        49000,
        [52000, 53000]
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return valid for complete SHORT trade', () => {
      const result = validator.validateTrade(
        'ETHUSDT',
        TradeSide.SHORT,
        3000,
        3100,
        [2900, 2800]
      );

      expect(result.valid).toBe(true);
    });

    it('should return valid for trade without SL', () => {
      const result = validator.validateTrade(
        'BTCUSDT',
        TradeSide.LONG,
        50000,
        null,
        [52000]
      );

      expect(result.valid).toBe(true);
    });

    it('should return valid for trade without TPs', () => {
      const result = validator.validateTrade(
        'BTCUSDT',
        TradeSide.LONG,
        50000,
        49000,
        null
      );

      expect(result.valid).toBe(true);
    });

    it('should return invalid when symbol is missing', () => {
      const result = validator.validateTrade(
        null,
        TradeSide.LONG,
        50000,
        49000,
        [52000]
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Symbol is required');
    });

    it('should return invalid when side is missing', () => {
      const result = validator.validateTrade(
        'BTCUSDT',
        null,
        50000,
        49000,
        [52000]
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Side is required (LONG, SHORT, or SPOT)');
    });

    it('should return invalid when entry is missing', () => {
      const result = validator.validateTrade(
        'BTCUSDT',
        TradeSide.LONG,
        null,
        49000,
        [52000]
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Entry price is required');
    });

    it('should aggregate multiple errors', () => {
      const result = validator.validateTrade(
        null,
        null,
        null,
        -100,
        [-50]
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});