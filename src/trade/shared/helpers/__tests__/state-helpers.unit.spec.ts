import {
  isActiveTrade,
  isClosedTrade,
  isPendingTrade,
  canModifyEntry,
  canModifySL,
  canModifyTP,
  canManualClose,
  canCancel,
  canMoveToBreakeven,
} from '../state-helpers';
import { TradeStatus } from '../../types/trade-status';

describe('isActiveTrade', () => {
  it('should return true for PENDING', () => {
    expect(isActiveTrade(TradeStatus.PENDING)).toBe(true);
  });

  it('should return true for ACTIVE', () => {
    expect(isActiveTrade(TradeStatus.ACTIVE)).toBe(true);
  });

  it('should return true for PARTIAL_TP', () => {
    expect(isActiveTrade(TradeStatus.PARTIAL_TP)).toBe(true);
  });

  it('should return true for BREAKEVEN', () => {
    expect(isActiveTrade(TradeStatus.BREAKEVEN)).toBe(true);
  });

  it('should return false for CLOSED_WIN', () => {
    expect(isActiveTrade(TradeStatus.CLOSED_WIN)).toBe(false);
  });

  it('should return false for CLOSED_LOSS', () => {
    expect(isActiveTrade(TradeStatus.CLOSED_LOSS)).toBe(false);
  });

  it('should return false for CANCELLED', () => {
    expect(isActiveTrade(TradeStatus.CANCELLED)).toBe(false);
  });
});

describe('isClosedTrade', () => {
  it('should return true for CLOSED_WIN', () => {
    expect(isClosedTrade(TradeStatus.CLOSED_WIN)).toBe(true);
  });

  it('should return true for CLOSED_PARTIAL', () => {
    expect(isClosedTrade(TradeStatus.CLOSED_PARTIAL)).toBe(true);
  });

  it('should return true for CLOSED_LOSS', () => {
    expect(isClosedTrade(TradeStatus.CLOSED_LOSS)).toBe(true);
  });

  it('should return true for CLOSED_BREAKEVEN', () => {
    expect(isClosedTrade(TradeStatus.CLOSED_BREAKEVEN)).toBe(true);
  });

  it('should return true for CLOSED_MANUAL', () => {
    expect(isClosedTrade(TradeStatus.CLOSED_MANUAL)).toBe(true);
  });

  it('should return false for PENDING', () => {
    expect(isClosedTrade(TradeStatus.PENDING)).toBe(false);
  });

  it('should return false for ACTIVE', () => {
    expect(isClosedTrade(TradeStatus.ACTIVE)).toBe(false);
  });
});

describe('isPendingTrade', () => {
  it('should return true for PENDING', () => {
    expect(isPendingTrade(TradeStatus.PENDING)).toBe(true);
  });

  it('should return false for ACTIVE', () => {
    expect(isPendingTrade(TradeStatus.ACTIVE)).toBe(false);
  });
});

describe('canModifyEntry', () => {
  it('should return true for PENDING', () => {
    expect(canModifyEntry(TradeStatus.PENDING)).toBe(true);
  });

  it('should return false for ACTIVE', () => {
    expect(canModifyEntry(TradeStatus.ACTIVE)).toBe(false);
  });
});

describe('canModifySL', () => {
  it('should return true for ACTIVE', () => {
    expect(canModifySL(TradeStatus.ACTIVE)).toBe(true);
  });

  it('should return true for PARTIAL_TP', () => {
    expect(canModifySL(TradeStatus.PARTIAL_TP)).toBe(true);
  });

  it('should return true for BREAKEVEN', () => {
    expect(canModifySL(TradeStatus.BREAKEVEN)).toBe(true);
  });

  it('should return true for PENDING (can set initial SL)', () => {
    expect(canModifySL(TradeStatus.PENDING)).toBe(true);
  });

  it('should return false for CLOSED_WIN', () => {
    expect(canModifySL(TradeStatus.CLOSED_WIN)).toBe(false);
  });
});

describe('canModifyTP', () => {
  it('should return true for ACTIVE', () => {
    expect(canModifyTP(TradeStatus.ACTIVE)).toBe(true);
  });

  it('should return true for PARTIAL_TP', () => {
    expect(canModifyTP(TradeStatus.PARTIAL_TP)).toBe(true);
  });

  it('should return true for PENDING (can set initial TP)', () => {
    expect(canModifyTP(TradeStatus.PENDING)).toBe(true);
  });
});

describe('canManualClose', () => {
  it('should return true for ACTIVE', () => {
    expect(canManualClose(TradeStatus.ACTIVE)).toBe(true);
  });

  it('should return true for PARTIAL_TP', () => {
    expect(canManualClose(TradeStatus.PARTIAL_TP)).toBe(true);
  });

  it('should return true for BREAKEVEN', () => {
    expect(canManualClose(TradeStatus.BREAKEVEN)).toBe(true);
  });

  it('should return false for PENDING (use cancel instead)', () => {
    expect(canManualClose(TradeStatus.PENDING)).toBe(false);
  });
});

describe('canCancel', () => {
  it('should return true for PENDING', () => {
    expect(canCancel(TradeStatus.PENDING)).toBe(true);
  });

  it('should return false for ACTIVE', () => {
    expect(canCancel(TradeStatus.ACTIVE)).toBe(false);
  });
});

describe('canMoveToBreakeven', () => {
  it('should return true for ACTIVE', () => {
    expect(canMoveToBreakeven(TradeStatus.ACTIVE)).toBe(true);
  });

  it('should return true for PARTIAL_TP', () => {
    expect(canMoveToBreakeven(TradeStatus.PARTIAL_TP)).toBe(true);
  });

  it('should return false for PENDING', () => {
    expect(canMoveToBreakeven(TradeStatus.PENDING)).toBe(false);
  });

  it('should return false for BREAKEVEN', () => {
    expect(canMoveToBreakeven(TradeStatus.BREAKEVEN)).toBe(false);
  });
});