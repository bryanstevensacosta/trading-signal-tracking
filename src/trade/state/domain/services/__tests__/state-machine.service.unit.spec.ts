import { StateMachineService, TransitionResult } from '../state-machine.service';
import { Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared';

describe('StateMachineService', () => {
  let stateMachine: StateMachineService;

  beforeEach(() => {
    stateMachine = new StateMachineService();
  });

  const createTrade = (status: TradeStatus): Trade => ({
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
    status,
    sourceMessage: 'test',
    sourceChat: null,
    tpsHit: [],
    notificationMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
  });

  describe('canTransition', () => {
    it('should allow PENDING to ACTIVE', () => {
      const trade = createTrade(TradeStatus.PENDING);
      expect(stateMachine.canTransition(trade, TradeStatus.ACTIVE)).toBe(true);
    });

    it('should allow PENDING to CANCELLED', () => {
      const trade = createTrade(TradeStatus.PENDING);
      expect(stateMachine.canTransition(trade, TradeStatus.CANCELLED)).toBe(true);
    });

    it('should allow ACTIVE to PARTIAL_TP', () => {
      const trade = createTrade(TradeStatus.ACTIVE);
      expect(stateMachine.canTransition(trade, TradeStatus.PARTIAL_TP)).toBe(true);
    });

    it('should allow ACTIVE to BREAKEVEN', () => {
      const trade = createTrade(TradeStatus.ACTIVE);
      expect(stateMachine.canTransition(trade, TradeStatus.BREAKEVEN)).toBe(true);
    });

    it('should allow ACTIVE to CLOSED_WIN', () => {
      const trade = createTrade(TradeStatus.ACTIVE);
      expect(stateMachine.canTransition(trade, TradeStatus.CLOSED_WIN)).toBe(true);
    });

    it('should allow ACTIVE to CLOSED_LOSS', () => {
      const trade = createTrade(TradeStatus.ACTIVE);
      expect(stateMachine.canTransition(trade, TradeStatus.CLOSED_LOSS)).toBe(true);
    });

    it('should allow ACTIVE to CLOSED_MANUAL', () => {
      const trade = createTrade(TradeStatus.ACTIVE);
      expect(stateMachine.canTransition(trade, TradeStatus.CLOSED_MANUAL)).toBe(true);
    });

    it('should allow PARTIAL_TP to PARTIAL_TP', () => {
      const trade = createTrade(TradeStatus.PARTIAL_TP);
      expect(stateMachine.canTransition(trade, TradeStatus.PARTIAL_TP)).toBe(true);
    });

    it('should allow PARTIAL_TP to BREAKEVEN', () => {
      const trade = createTrade(TradeStatus.PARTIAL_TP);
      expect(stateMachine.canTransition(trade, TradeStatus.BREAKEVEN)).toBe(true);
    });

    it('should allow PARTIAL_TP to CLOSED_PARTIAL', () => {
      const trade = createTrade(TradeStatus.PARTIAL_TP);
      expect(stateMachine.canTransition(trade, TradeStatus.CLOSED_PARTIAL)).toBe(true);
    });

    it('should allow PARTIAL_TP to CLOSED_LOSS', () => {
      const trade = createTrade(TradeStatus.PARTIAL_TP);
      expect(stateMachine.canTransition(trade, TradeStatus.CLOSED_LOSS)).toBe(true);
    });

    it('should allow BREAKEVEN to CLOSED_BREAKEVEN', () => {
      const trade = createTrade(TradeStatus.BREAKEVEN);
      expect(stateMachine.canTransition(trade, TradeStatus.CLOSED_BREAKEVEN)).toBe(true);
    });

    it('should allow BREAKEVEN to CLOSED_MANUAL', () => {
      const trade = createTrade(TradeStatus.BREAKEVEN);
      expect(stateMachine.canTransition(trade, TradeStatus.CLOSED_MANUAL)).toBe(true);
    });

    it('should not allow PENDING to CLOSED_WIN', () => {
      const trade = createTrade(TradeStatus.PENDING);
      expect(stateMachine.canTransition(trade, TradeStatus.CLOSED_WIN)).toBe(false);
    });

    it('should not allow CLOSED_WIN to ACTIVE', () => {
      const trade = createTrade(TradeStatus.CLOSED_WIN);
      expect(stateMachine.canTransition(trade, TradeStatus.ACTIVE)).toBe(false);
    });

    it('should not allow CLOSED_LOSS to PENDING', () => {
      const trade = createTrade(TradeStatus.CLOSED_LOSS);
      expect(stateMachine.canTransition(trade, TradeStatus.PENDING)).toBe(false);
    });

    it('should not allow CANCELLED to ACTIVE', () => {
      const trade = createTrade(TradeStatus.CANCELLED);
      expect(stateMachine.canTransition(trade, TradeStatus.ACTIVE)).toBe(false);
    });
  });

  describe('transition', () => {
    it('should return success for valid transition', () => {
      const trade = createTrade(TradeStatus.PENDING);
      const result = stateMachine.transition(trade, TradeStatus.ACTIVE);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(TradeStatus.ACTIVE);
    });

    it('should return error for invalid transition', () => {
      const trade = createTrade(TradeStatus.CLOSED_WIN);
      const result = stateMachine.transition(trade, TradeStatus.ACTIVE);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid transition');
    });
  });

  describe('activate', () => {
    it('should activate pending trade', () => {
      const trade = createTrade(TradeStatus.PENDING);
      const result = stateMachine.activate(trade);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(TradeStatus.ACTIVE);
    });

    it('should not activate closed trade', () => {
      const trade = createTrade(TradeStatus.CLOSED_WIN);
      const result = stateMachine.activate(trade);

      expect(result.success).toBe(false);
    });
  });

  describe('closeWithTP', () => {
    it('should close active trade with TP', () => {
      const trade = createTrade(TradeStatus.ACTIVE);
      const result = stateMachine.closeWithTP(trade);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(TradeStatus.CLOSED_WIN);
    });
  });

  describe('closeWithSL', () => {
    it('should close active trade with SL', () => {
      const trade = createTrade(TradeStatus.ACTIVE);
      const result = stateMachine.closeWithSL(trade);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(TradeStatus.CLOSED_LOSS);
    });
  });

  describe('closeManual', () => {
    it('should manually close active trade', () => {
      const trade = createTrade(TradeStatus.ACTIVE);
      const result = stateMachine.closeManual(trade);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(TradeStatus.CLOSED_MANUAL);
    });

    it('should manually close partial TP trade', () => {
      const trade = createTrade(TradeStatus.PARTIAL_TP);
      const result = stateMachine.closeManual(trade);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(TradeStatus.CLOSED_MANUAL);
    });
  });

  describe('cancel', () => {
    it('should cancel pending trade', () => {
      const trade = createTrade(TradeStatus.PENDING);
      const result = stateMachine.cancel(trade);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(TradeStatus.CANCELLED);
    });

    it('should not cancel active trade', () => {
      const trade = createTrade(TradeStatus.ACTIVE);
      const result = stateMachine.cancel(trade);

      expect(result.success).toBe(false);
    });
  });

  describe('moveToBreakeven', () => {
    it('should move active trade to breakeven', () => {
      const trade = createTrade(TradeStatus.ACTIVE);
      const result = stateMachine.moveToBreakeven(trade);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(TradeStatus.BREAKEVEN);
    });

    it('should move partial TP trade to breakeven', () => {
      const trade = createTrade(TradeStatus.PARTIAL_TP);
      const result = stateMachine.moveToBreakeven(trade);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(TradeStatus.BREAKEVEN);
    });
  });

  describe('partialTP', () => {
    it('should mark active trade with partial TP', () => {
      const trade = createTrade(TradeStatus.ACTIVE);
      const result = stateMachine.partialTP(trade);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(TradeStatus.PARTIAL_TP);
    });

    it('should allow more partial TPs', () => {
      const trade = createTrade(TradeStatus.PARTIAL_TP);
      const result = stateMachine.partialTP(trade);

      expect(result.success).toBe(true);
    });
  });
});