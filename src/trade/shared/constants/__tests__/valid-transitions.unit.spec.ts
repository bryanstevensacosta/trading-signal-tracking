import { isValidTransition, VALID_TRANSITIONS } from '../valid-transitions';
import { TradeStatus } from '../../types';

describe('valid-transitions', () => {
  describe('VALID_TRANSITIONS', () => {
    it('should have entry for all TradeStatus values', () => {
      const statuses = Object.values(TradeStatus);
      statuses.forEach((status) => {
        expect(VALID_TRANSITIONS).toHaveProperty(status);
        expect(Array.isArray(VALID_TRANSITIONS[status])).toBe(true);
      });
    });

    it('PENDING should transition to ACTIVE and CANCELLED only', () => {
      expect(VALID_TRANSITIONS[TradeStatus.PENDING]).toEqual([
        TradeStatus.ACTIVE,
        TradeStatus.CANCELLED,
      ]);
    });

    it('ACTIVE should have 5 valid transitions', () => {
      expect(VALID_TRANSITIONS[TradeStatus.ACTIVE]).toHaveLength(5);
      expect(VALID_TRANSITIONS[TradeStatus.ACTIVE]).toContain(TradeStatus.PARTIAL_TP);
      expect(VALID_TRANSITIONS[TradeStatus.ACTIVE]).toContain(TradeStatus.BREAKEVEN);
      expect(VALID_TRANSITIONS[TradeStatus.ACTIVE]).toContain(TradeStatus.CLOSED_WIN);
      expect(VALID_TRANSITIONS[TradeStatus.ACTIVE]).toContain(TradeStatus.CLOSED_LOSS);
      expect(VALID_TRANSITIONS[TradeStatus.ACTIVE]).toContain(TradeStatus.CLOSED_MANUAL);
    });

    it('PARTIAL_TP should allow self-transition', () => {
      expect(VALID_TRANSITIONS[TradeStatus.PARTIAL_TP]).toContain(TradeStatus.PARTIAL_TP);
    });

    it('closed states should have empty transitions', () => {
      expect(VALID_TRANSITIONS[TradeStatus.CLOSED_WIN]).toEqual([]);
      expect(VALID_TRANSITIONS[TradeStatus.CLOSED_PARTIAL]).toEqual([]);
      expect(VALID_TRANSITIONS[TradeStatus.CLOSED_LOSS]).toEqual([]);
      expect(VALID_TRANSITIONS[TradeStatus.CLOSED_BREAKEVEN]).toEqual([]);
      expect(VALID_TRANSITIONS[TradeStatus.CLOSED_MANUAL]).toEqual([]);
      expect(VALID_TRANSITIONS[TradeStatus.CANCELLED]).toEqual([]);
    });
  });

  describe('isValidTransition', () => {
    describe('valid transitions', () => {
      it('should return true for PENDING -> ACTIVE', () => {
        expect(isValidTransition(TradeStatus.PENDING, TradeStatus.ACTIVE)).toBe(true);
      });

      it('should return true for PENDING -> CANCELLED', () => {
        expect(isValidTransition(TradeStatus.PENDING, TradeStatus.CANCELLED)).toBe(true);
      });

      it('should return true for ACTIVE -> PARTIAL_TP', () => {
        expect(isValidTransition(TradeStatus.ACTIVE, TradeStatus.PARTIAL_TP)).toBe(true);
      });

      it('should return true for ACTIVE -> BREAKEVEN', () => {
        expect(isValidTransition(TradeStatus.ACTIVE, TradeStatus.BREAKEVEN)).toBe(true);
      });

      it('should return true for ACTIVE -> CLOSED_WIN', () => {
        expect(isValidTransition(TradeStatus.ACTIVE, TradeStatus.CLOSED_WIN)).toBe(true);
      });

      it('should return true for ACTIVE -> CLOSED_LOSS', () => {
        expect(isValidTransition(TradeStatus.ACTIVE, TradeStatus.CLOSED_LOSS)).toBe(true);
      });

      it('should return true for ACTIVE -> CLOSED_MANUAL', () => {
        expect(isValidTransition(TradeStatus.ACTIVE, TradeStatus.CLOSED_MANUAL)).toBe(true);
      });

      it('should return true for PARTIAL_TP -> PARTIAL_TP (self-transition)', () => {
        expect(isValidTransition(TradeStatus.PARTIAL_TP, TradeStatus.PARTIAL_TP)).toBe(true);
      });

      it('should return true for PARTIAL_TP -> BREAKEVEN', () => {
        expect(isValidTransition(TradeStatus.PARTIAL_TP, TradeStatus.BREAKEVEN)).toBe(true);
      });

      it('should return true for PARTIAL_TP -> CLOSED_PARTIAL', () => {
        expect(isValidTransition(TradeStatus.PARTIAL_TP, TradeStatus.CLOSED_PARTIAL)).toBe(true);
      });

      it('should return true for PARTIAL_TP -> CLOSED_LOSS', () => {
        expect(isValidTransition(TradeStatus.PARTIAL_TP, TradeStatus.CLOSED_LOSS)).toBe(true);
      });

      it('should return true for PARTIAL_TP -> CLOSED_MANUAL', () => {
        expect(isValidTransition(TradeStatus.PARTIAL_TP, TradeStatus.CLOSED_MANUAL)).toBe(true);
      });

      it('should return true for BREAKEVEN -> CLOSED_BREAKEVEN', () => {
        expect(isValidTransition(TradeStatus.BREAKEVEN, TradeStatus.CLOSED_BREAKEVEN)).toBe(true);
      });

      it('should return true for BREAKEVEN -> CLOSED_MANUAL', () => {
        expect(isValidTransition(TradeStatus.BREAKEVEN, TradeStatus.CLOSED_MANUAL)).toBe(true);
      });
    });

    describe('invalid transitions', () => {
      it('should return false for PENDING -> CLOSED_WIN', () => {
        expect(isValidTransition(TradeStatus.PENDING, TradeStatus.CLOSED_WIN)).toBe(false);
      });

      it('should return false for PENDING -> CLOSED_LOSS', () => {
        expect(isValidTransition(TradeStatus.PENDING, TradeStatus.CLOSED_LOSS)).toBe(false);
      });

      it('should return false for PENDING -> PARTIAL_TP', () => {
        expect(isValidTransition(TradeStatus.PENDING, TradeStatus.PARTIAL_TP)).toBe(false);
      });

      it('should return false for CLOSED_WIN -> any state', () => {
        Object.values(TradeStatus).forEach((target) => {
          expect(isValidTransition(TradeStatus.CLOSED_WIN, target)).toBe(false);
        });
      });

      it('should return false for CLOSED_LOSS -> any state', () => {
        Object.values(TradeStatus).forEach((target) => {
          expect(isValidTransition(TradeStatus.CLOSED_LOSS, target)).toBe(false);
        });
      });

      it('should return false for CLOSED_PARTIAL -> any state', () => {
        Object.values(TradeStatus).forEach((target) => {
          expect(isValidTransition(TradeStatus.CLOSED_PARTIAL, target)).toBe(false);
        });
      });

      it('should return false for CLOSED_BREAKEVEN -> any state', () => {
        Object.values(TradeStatus).forEach((target) => {
          expect(isValidTransition(TradeStatus.CLOSED_BREAKEVEN, target)).toBe(false);
        });
      });

      it('should return false for CLOSED_MANUAL -> any state', () => {
        Object.values(TradeStatus).forEach((target) => {
          expect(isValidTransition(TradeStatus.CLOSED_MANUAL, target)).toBe(false);
        });
      });

      it('should return false for CANCELLED -> any state', () => {
        Object.values(TradeStatus).forEach((target) => {
          expect(isValidTransition(TradeStatus.CANCELLED, target)).toBe(false);
        });
      });

      it('should return false for backward transitions', () => {
        expect(isValidTransition(TradeStatus.ACTIVE, TradeStatus.PENDING)).toBe(false);
        expect(isValidTransition(TradeStatus.PARTIAL_TP, TradeStatus.ACTIVE)).toBe(false);
        expect(isValidTransition(TradeStatus.BREAKEVEN, TradeStatus.PARTIAL_TP)).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should return false for invalid from status', () => {
        expect(isValidTransition('INVALID' as TradeStatus, TradeStatus.ACTIVE)).toBe(false);
      });

      it('should return false for invalid to status', () => {
        expect(isValidTransition(TradeStatus.PENDING, 'INVALID' as TradeStatus)).toBe(false);
      });

      it('should return false for null/undefined from', () => {
        expect(isValidTransition(null as any, TradeStatus.ACTIVE)).toBe(false);
        expect(isValidTransition(undefined as any, TradeStatus.ACTIVE)).toBe(false);
      });

      it('should return false for null/undefined to', () => {
        expect(isValidTransition(TradeStatus.PENDING, null as any)).toBe(false);
        expect(isValidTransition(TradeStatus.PENDING, undefined as any)).toBe(false);
      });
    });
  });
});