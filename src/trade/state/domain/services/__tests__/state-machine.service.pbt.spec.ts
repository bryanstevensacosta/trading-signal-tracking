import { StateMachineService } from '../state-machine.service';
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
    tps: [52000, 54000],
    chartUrl: null,
    notes: null,
    status,
    sourceMessage: 'test',
    sourceChat: null,
    tpsHit: [],
    tradeAlertsMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
  });

  describe('property-based: valid transitions', () => {
    it('should allow transitions from PENDING', () => {
      const trade = createTrade(TradeStatus.PENDING);
      const validTargets = [TradeStatus.ACTIVE, TradeStatus.CANCELLED];

      for (const target of validTargets) {
        const result = stateMachine.transition(trade, target);
        expect(result.success).toBe(true);
      }
    });

    it('should allow transitions from ACTIVE', () => {
      const trade = createTrade(TradeStatus.ACTIVE);
      const validTargets = [
        TradeStatus.PARTIAL_TP,
        TradeStatus.BREAKEVEN,
        TradeStatus.CLOSED_WIN,
        TradeStatus.CLOSED_LOSS,
        TradeStatus.CLOSED_MANUAL,
      ];

      for (const target of validTargets) {
        const result = stateMachine.transition(trade, target);
        expect(result.success).toBe(true);
      }
    });

    it('should allow transitions from PARTIAL_TP', () => {
      const trade = createTrade(TradeStatus.PARTIAL_TP);
      const validTargets = [
        TradeStatus.PARTIAL_TP,
        TradeStatus.BREAKEVEN,
        TradeStatus.CLOSED_PARTIAL,
        TradeStatus.CLOSED_LOSS,
        TradeStatus.CLOSED_MANUAL,
      ];

      for (const target of validTargets) {
        const result = stateMachine.transition(trade, target);
        expect(result.success).toBe(true);
      }
    });

    it('should not allow transitions from closed states', () => {
      const closedStatuses = [
        TradeStatus.CLOSED_WIN,
        TradeStatus.CLOSED_PARTIAL,
        TradeStatus.CLOSED_LOSS,
        TradeStatus.CLOSED_BREAKEVEN,
        TradeStatus.CLOSED_MANUAL,
        TradeStatus.CANCELLED,
      ];

      for (const status of closedStatuses) {
        const trade = createTrade(status);
        const result = stateMachine.transition(trade, TradeStatus.ACTIVE);
        expect(result.success).toBe(false);
      }
    });

    it('should not allow backward transitions from ACTIVE', () => {
      const trade = createTrade(TradeStatus.ACTIVE);
      const invalidTargets = [TradeStatus.PENDING, TradeStatus.CANCELLED];

      for (const target of invalidTargets) {
        const result = stateMachine.transition(trade, target);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('property-based: closed states are terminal', () => {
    it('closed trades should not transition to any other state', () => {
      const closedStatuses = [
        TradeStatus.CLOSED_WIN,
        TradeStatus.CLOSED_PARTIAL,
        TradeStatus.CLOSED_LOSS,
        TradeStatus.CLOSED_BREAKEVEN,
        TradeStatus.CLOSED_MANUAL,
      ];
      const allStatuses = Object.values(TradeStatus);

      for (const closedStatus of closedStatuses) {
        const trade = createTrade(closedStatus);
        
        for (const target of allStatuses) {
          const result = stateMachine.transition(trade, target);
          expect(result.success).toBe(false);
        }
      }
    });
  });

  describe('property-based: cancelled state is terminal', () => {
    it('cancelled trades should not transition', () => {
      const trade = createTrade(TradeStatus.CANCELLED);
      const allStatuses = Object.values(TradeStatus);

      for (const target of allStatuses) {
        const result = stateMachine.transition(trade, target);
        expect(result.success).toBe(false);
      }
    });
  });
});