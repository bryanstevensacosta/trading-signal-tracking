import { ValidationService, ValidationResult } from '../validation.service';
import { Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared';

describe('ValidationService', () => {
  let service: ValidationService;

  beforeEach(() => {
    service = new ValidationService();
  });

  const createMockTrade = (status: TradeStatus, side: TradeSide = TradeSide.LONG, entry = 50000, sl = 49000): Trade => ({
    id: 'test-id',
    symbol: 'BTCUSDT',
    side,
    orderType: OrderType.LIMIT,
    entry,
    entryMax: null,
    entryExecutedPrice: null,
    entryExecutedAt: null,
    sl,
    tps: [52000],
    chartUrl: null,
    notes: null,
    status,
    sourceMessage: 'test',
    sourceChat: null,
    tpsHit: [],
    notificationMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
  });

  describe('validateTradeId', () => {
    it('should return valid for non-empty trade ID', () => {
      const result = service.validateTradeId('123');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid for empty trade ID', () => {
      const result = service.validateTradeId('');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Trade ID is required');
    });

    it('should return invalid for whitespace-only trade ID', () => {
      const result = service.validateTradeId('   ');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Trade ID is required');
    });
  });

  describe('validateEntryPrice', () => {
    it('should return valid for positive price', () => {
      const result = service.validateEntryPrice(50000);

      expect(result.valid).toBe(true);
    });

    it('should return invalid for zero', () => {
      const result = service.validateEntryPrice(0);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Entry must be a positive number');
    });

    it('should return invalid for negative', () => {
      const result = service.validateEntryPrice(-100);

      expect(result.valid).toBe(false);
    });
  });

  describe('validateModifyEntry', () => {
    it('should return valid for pending trade with valid entry', () => {
      const trade = createMockTrade(TradeStatus.PENDING);
      const result = service.validateModifyEntry(trade, 51000);

      expect(result.valid).toBe(true);
    });

    it('should return invalid for non-pending trade', () => {
      const trade = createMockTrade(TradeStatus.ACTIVE);
      const result = service.validateModifyEntry(trade, 51000);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Can only modify entry for pending trades');
    });

    it('should return invalid if entry is below SL', () => {
      const trade = createMockTrade(TradeStatus.PENDING, TradeSide.LONG, 50000, 49000);
      const result = service.validateModifyEntry(trade, 48000);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Entry cannot be below SL');
    });

    it('should return invalid for non-positive entry', () => {
      const trade = createMockTrade(TradeStatus.PENDING);
      const result = service.validateModifyEntry(trade, -100);

      expect(result.valid).toBe(false);
    });
  });

  describe('validateModifySL', () => {
    it('should return valid for active trade with valid SL', () => {
      const trade = createMockTrade(TradeStatus.ACTIVE, TradeSide.LONG, 50000, 49000);
      const result = service.validateModifySL(trade, 48500);

      expect(result.valid).toBe(true);
    });

    it('should return valid for pending trade (isActiveTrade includes pending)', () => {
      const trade = createMockTrade(TradeStatus.PENDING);
      const result = service.validateModifySL(trade, 48000);

      expect(result.valid).toBe(true);
    });

    it('should return invalid for LONG if SL is above entry', () => {
      const trade = createMockTrade(TradeStatus.ACTIVE, TradeSide.LONG, 50000, 49000);
      const result = service.validateModifySL(trade, 51000);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('SL must be below entry for LONG trades');
    });

    it('should return invalid for SHORT if SL is below entry', () => {
      const trade = createMockTrade(TradeStatus.ACTIVE, TradeSide.SHORT, 50000, 51000);
      const result = service.validateModifySL(trade, 49000);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('SL must be above entry for SHORT trades');
    });
  });

  describe('validateModifyTP', () => {
    it('should return valid for active trade with valid TPs', () => {
      const trade = createMockTrade(TradeStatus.ACTIVE);
      const result = service.validateModifyTP(trade, [52000, 53000]);

      expect(result.valid).toBe(true);
    });

    it('should return valid for pending trade (isActiveTrade includes pending)', () => {
      const trade = createMockTrade(TradeStatus.PENDING);
      const result = service.validateModifyTP(trade, [52000]);

      expect(result.valid).toBe(true);
    });

    it('should return invalid if any TP is non-positive', () => {
      const trade = createMockTrade(TradeStatus.ACTIVE);
      const result = service.validateModifyTP(trade, [52000, -100]);

      expect(result.valid).toBe(false);
    });
  });

  describe('validateCancel', () => {
    it('should return valid for pending trade', () => {
      const trade = createMockTrade(TradeStatus.PENDING);
      const result = service.validateCancel(trade);

      expect(result.valid).toBe(true);
    });

    it('should return invalid for active trade', () => {
      const trade = createMockTrade(TradeStatus.ACTIVE);
      const result = service.validateCancel(trade);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Can only cancel pending trades');
    });

    it('should return invalid for partial TP trade', () => {
      const trade = createMockTrade(TradeStatus.PARTIAL_TP);
      const result = service.validateCancel(trade);

      expect(result.valid).toBe(false);
    });
  });

  describe('validateClose', () => {
    it('should return valid for active trade', () => {
      const trade = createMockTrade(TradeStatus.ACTIVE);
      const result = service.validateClose(trade);

      expect(result.valid).toBe(true);
    });

    it('should return valid for partial TP trade', () => {
      const trade = createMockTrade(TradeStatus.PARTIAL_TP);
      const result = service.validateClose(trade);

      expect(result.valid).toBe(true);
    });

    it('should return invalid for pending trade (use cancel instead)', () => {
      const trade = createMockTrade(TradeStatus.PENDING);
      const result = service.validateClose(trade);

      expect(result.valid).toBe(false);
    });

    it('should return invalid for closed trade', () => {
      const trade = createMockTrade(TradeStatus.CLOSED_WIN);
      const result = service.validateClose(trade);

      expect(result.valid).toBe(false);
    });
  });

  describe('validateBreakeven', () => {
    it('should return valid for active trade', () => {
      const trade = createMockTrade(TradeStatus.ACTIVE);
      const result = service.validateBreakeven(trade);

      expect(result.valid).toBe(true);
    });

    it('should return valid for partial TP trade', () => {
      const trade = createMockTrade(TradeStatus.PARTIAL_TP);
      const result = service.validateBreakeven(trade);

      expect(result.valid).toBe(true);
    });

    it('should return invalid for pending trade', () => {
      const trade = createMockTrade(TradeStatus.PENDING);
      const result = service.validateBreakeven(trade);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Can only move to breakeven for active or partial TP trades');
    });
  });

  describe('validateDelete', () => {
    it('should return valid for closed trade', () => {
      const trade = createMockTrade(TradeStatus.CLOSED_WIN);
      const result = service.validateDelete(trade);

      expect(result.valid).toBe(true);
    });

    it('should return valid for cancelled trade', () => {
      const trade = createMockTrade(TradeStatus.CANCELLED);
      const result = service.validateDelete(trade);

      expect(result.valid).toBe(true);
    });

    it('should return invalid for pending trade', () => {
      const trade = createMockTrade(TradeStatus.PENDING);
      const result = service.validateDelete(trade);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Can only delete closed or cancelled trades');
    });

    it('should return invalid for active trade', () => {
      const trade = createMockTrade(TradeStatus.ACTIVE);
      const result = service.validateDelete(trade);

      expect(result.valid).toBe(false);
    });
  });
});