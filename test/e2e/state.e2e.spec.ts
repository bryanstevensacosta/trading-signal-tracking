import { StateMachineService } from '../../src/trade/state/domain/services/state-machine.service';
import { Trade, TradeStatus, TradeSide, OrderType } from '../../src/trade/shared';

describe('Trade State (e2e)', () => {
  let stateMachine: StateMachineService;

  beforeAll(() => {
    stateMachine = new StateMachineService();
  });

  const createTrade = (id: string, status: TradeStatus): Trade => ({
    id,
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

  describe('State Machine - Valid Transitions', () => {
    it('should transition PENDING to ACTIVE', () => {
      const trade = createTrade('1', TradeStatus.PENDING);
      const result = stateMachine.transition(trade, TradeStatus.ACTIVE);
      expect(result.success).toBe(true);
    });

    it('should transition PENDING to CANCELLED', () => {
      const trade = createTrade('1', TradeStatus.PENDING);
      const result = stateMachine.transition(trade, TradeStatus.CANCELLED);
      expect(result.success).toBe(true);
    });

    it('should transition ACTIVE to PARTIAL_TP', () => {
      const trade = createTrade('1', TradeStatus.ACTIVE);
      const result = stateMachine.transition(trade, TradeStatus.PARTIAL_TP);
      expect(result.success).toBe(true);
    });

    it('should transition ACTIVE to BREAKEVEN', () => {
      const trade = createTrade('1', TradeStatus.ACTIVE);
      const result = stateMachine.transition(trade, TradeStatus.BREAKEVEN);
      expect(result.success).toBe(true);
    });

    it('should transition ACTIVE to CLOSED_WIN', () => {
      const trade = createTrade('1', TradeStatus.ACTIVE);
      const result = stateMachine.transition(trade, TradeStatus.CLOSED_WIN);
      expect(result.success).toBe(true);
    });

    it('should transition ACTIVE to CLOSED_LOSS', () => {
      const trade = createTrade('1', TradeStatus.ACTIVE);
      const result = stateMachine.transition(trade, TradeStatus.CLOSED_LOSS);
      expect(result.success).toBe(true);
    });

    it('should transition PARTIAL_TP to CLOSED_PARTIAL', () => {
      const trade = createTrade('1', TradeStatus.PARTIAL_TP);
      const result = stateMachine.transition(trade, TradeStatus.CLOSED_PARTIAL);
      expect(result.success).toBe(true);
    });

    it('should transition BREAKEVEN to CLOSED_BREAKEVEN', () => {
      const trade = createTrade('1', TradeStatus.BREAKEVEN);
      const result = stateMachine.transition(trade, TradeStatus.CLOSED_BREAKEVEN);
      expect(result.success).toBe(true);
    });
  });

  describe('State Machine - Invalid Transitions', () => {
    it('should NOT transition PENDING to CLOSED_WIN', () => {
      const trade = createTrade('1', TradeStatus.PENDING);
      const result = stateMachine.transition(trade, TradeStatus.CLOSED_WIN);
      expect(result.success).toBe(false);
    });

    it('should NOT transition PENDING to CLOSED_LOSS', () => {
      const trade = createTrade('1', TradeStatus.PENDING);
      const result = stateMachine.transition(trade, TradeStatus.CLOSED_LOSS);
      expect(result.success).toBe(false);
    });

    it('should NOT transition from CLOSED states', () => {
      const closedStates = [
        TradeStatus.CLOSED_WIN,
        TradeStatus.CLOSED_PARTIAL,
        TradeStatus.CLOSED_LOSS,
        TradeStatus.CLOSED_BREAKEVEN,
        TradeStatus.CLOSED_MANUAL,
        TradeStatus.CANCELLED,
      ];

      for (const status of closedStates) {
        const trade = createTrade('1', status);
        const result = stateMachine.transition(trade, TradeStatus.ACTIVE);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('State Machine - Helper Methods', () => {
    it('activate should transition PENDING to ACTIVE', () => {
      const trade = createTrade('1', TradeStatus.PENDING);
      const result = stateMachine.activate(trade);
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(TradeStatus.ACTIVE);
    });

    it('closeWithTP should transition ACTIVE to CLOSED_WIN', () => {
      const trade = createTrade('1', TradeStatus.ACTIVE);
      const result = stateMachine.closeWithTP(trade);
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(TradeStatus.CLOSED_WIN);
    });

    it('closeWithSL should transition ACTIVE to CLOSED_LOSS', () => {
      const trade = createTrade('1', TradeStatus.ACTIVE);
      const result = stateMachine.closeWithSL(trade);
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(TradeStatus.CLOSED_LOSS);
    });

    it('closeManual should close from active states', () => {
      const activeStates = [TradeStatus.ACTIVE, TradeStatus.PARTIAL_TP, TradeStatus.BREAKEVEN];
      
      for (const status of activeStates) {
        const trade = createTrade('1', status);
        const result = stateMachine.closeManual(trade);
        expect(result.success).toBe(true);
        expect(result.newStatus).toBe(TradeStatus.CLOSED_MANUAL);
      }
    });

    it('cancel should only work from PENDING', () => {
      const trade = createTrade('1', TradeStatus.PENDING);
      const result = stateMachine.cancel(trade);
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(TradeStatus.CANCELLED);
    });

    it('moveToBreakeven should work from ACTIVE and PARTIAL_TP', () => {
      const states = [TradeStatus.ACTIVE, TradeStatus.PARTIAL_TP];
      
      for (const status of states) {
        const trade = createTrade('1', status);
        const result = stateMachine.moveToBreakeven(trade);
        expect(result.success).toBe(true);
        expect(result.newStatus).toBe(TradeStatus.BREAKEVEN);
      }
    });
  });
});