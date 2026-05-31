import { TriggerDetectorService, TriggerResult } from '../../src/trade/trigger/domain/services/trigger-detector.service';
import { StateMachineService } from '../../src/trade/state/domain/services/state-machine.service';
import { Trade, TradeStatus, TradeSide, Price, OrderType } from '../../src/trade/shared';

describe('Trade Recovery & Order Types (e2e)', () => {
  let triggerDetector: TriggerDetectorService;
  let stateMachine: StateMachineService;

  const createTrade = (overrides: Partial<Trade> = {}): Trade => ({
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
    status: TradeStatus.PENDING,
    sourceMessage: 'test',
    sourceChat: null,
    tpsHit: [],
    tradeAlertsMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
    ...overrides,
  });

  const createPrice = (overrides: Partial<Price> = {}): Price => ({
    symbol: 'BTCUSDT',
    bid: 50000,
    ask: 50001,
    last: 50000.5,
    timestamp: new Date(),
    exchange: 'binance',
    ...overrides,
  });

  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeAll(() => {
    triggerDetector = new TriggerDetectorService(mockLogger as any);
    stateMachine = new StateMachineService();
  });

  describe('Recovery Logic - Edge Cases', () => {
    describe('Skip conditions', () => {
      it('trigger detector does not check entryExecutedAt (recovery logic should check before calling)', () => {
        const trade = createTrade({
          status: TradeStatus.PENDING,
          entryExecutedAt: new Date('2026-05-24T06:00:00'),
          entryExecutedPrice: 48000,
        });
        const price = createPrice({ ask: 49000 });

        const result = triggerDetector.checkEntryHit(trade, price);

        expect(result.triggered).toBe(true);
      });

      it('should skip MARKET order (activates immediately, not via recovery)', () => {
        const trade = createTrade({
          orderType: OrderType.MARKET,
          status: TradeStatus.PENDING,
        });
        const price = createPrice({ ask: 50000 });

        const result = triggerDetector.checkEntryHit(trade, price);

        expect(result.triggered).toBe(true);
        expect(result.trigger).toBe('entry');
        expect(result.price).toBe(50000);
      });

      it('should skip non-pending trade', () => {
        const trade = createTrade({ status: TradeStatus.ACTIVE });
        const price = createPrice({ ask: 50000 });

        const result = triggerDetector.checkEntryHit(trade, price);

        expect(result.triggered).toBe(false);
      });
    });

    describe('Price not reached entry', () => {
      it('should trigger when price is better than entry (LONG lower is better)', () => {
        const trade = createTrade({
          entry: 50000,
          entryMax: 50100,
          side: TradeSide.LONG,
        });
        const price = createPrice({ ask: 45000 });

        const result = triggerDetector.checkEntryHit(trade, price);

        expect(result.triggered).toBe(true);
      });

      it('should trigger when price is better than entry (SHORT higher is better)', () => {
        const trade = createTrade({
          entry: 50000,
          entryMax: 49900,
          side: TradeSide.SHORT,
        });
        const price = createPrice({ bid: 55000 });

        const result = triggerDetector.checkEntryHit(trade, price);

        expect(result.triggered).toBe(true);
      });

      it('should NOT trigger when price is worse than entry for LONG (higher is worse)', () => {
        const trade = createTrade({
          entry: 50000,
          entryMax: 50100,
          side: TradeSide.LONG,
        });
        const price = createPrice({ ask: 51000 });

        const result = triggerDetector.checkEntryHit(trade, price);

        expect(result.triggered).toBe(false);
      });

      it('should NOT trigger when price is worse than entry for SHORT (lower is worse)', () => {
        const trade = createTrade({
          entry: 50000,
          entryMax: 49900,
          side: TradeSide.SHORT,
        });
        const price = createPrice({ bid: 49000 });

        const result = triggerDetector.checkEntryHit(trade, price);

        expect(result.triggered).toBe(false);
      });

      it('should NOT trigger when price above entryMax for LONG (slippage)', () => {
        const trade = createTrade({
          entry: 50000,
          entryMax: 51000,
          side: TradeSide.LONG,
        });
        const price = createPrice({ ask: 51500 });

        const result = triggerDetector.checkEntryHit(trade, price);

        expect(result.triggered).toBe(false);
      });

      it('should NOT trigger when price below entryMax for SHORT (slippage)', () => {
        const trade = createTrade({
          entry: 50000,
          entryMax: 49000,
          side: TradeSide.SHORT,
        });
        const price = createPrice({ bid: 48500 });

        const result = triggerDetector.checkEntryHit(trade, price);

        expect(result.triggered).toBe(false);
      });
    });

    describe('Entry price reached', () => {
      it('should trigger when price enters entry range (LONG)', () => {
        const trade = createTrade({
          entry: 50000,
          entryMax: 50100,
          side: TradeSide.LONG,
        });
        const price = createPrice({ ask: 50050 });

        const result = triggerDetector.checkEntryHit(trade, price);

        expect(result.triggered).toBe(true);
        expect(result.trigger).toBe('entry');
      });

      it('should trigger when price enters entry range (SHORT)', () => {
        const trade = createTrade({
          entry: 50000,
          entryMax: 49900,
          side: TradeSide.SHORT,
        });
        const price = createPrice({ bid: 49950 });

        const result = triggerDetector.checkEntryHit(trade, price);

        expect(result.triggered).toBe(true);
        expect(result.trigger).toBe('entry');
      });

      it('should trigger at exact entry price', () => {
        const trade = createTrade({
          entry: 50000,
          entryMax: 50000,
          side: TradeSide.LONG,
        });
        const price = createPrice({ ask: 50000 });

        const result = triggerDetector.checkEntryHit(trade, price);

        expect(result.triggered).toBe(true);
        expect(result.trigger).toBe('entry');
      });
    });

    describe('LIMIT fill at better price', () => {
      it('should trigger LONG when current price is better than entry (lower)', () => {
        const trade = createTrade({
          entry: 50000,
          side: TradeSide.LONG,
          orderType: OrderType.LIMIT,
        });
        const price = createPrice({ ask: 49500 });

        const result = triggerDetector.checkEntryHit(trade, price);

        expect(result.triggered).toBe(true);
        expect(result.trigger).toBe('entry');
      });

      it('should trigger SHORT when current price is better than entry (higher)', () => {
        const trade = createTrade({
          entry: 50000,
          side: TradeSide.SHORT,
          orderType: OrderType.LIMIT,
        });
        const price = createPrice({ bid: 50500 });

        const result = triggerDetector.checkEntryHit(trade, price);

        expect(result.triggered).toBe(true);
        expect(result.trigger).toBe('entry');
      });

      it('should NOT trigger LONG when price is worse (higher) than entry', () => {
        const trade = createTrade({
          entry: 50000,
          side: TradeSide.LONG,
          orderType: OrderType.LIMIT,
        });
        const price = createPrice({ ask: 50500 });

        const result = triggerDetector.checkEntryHit(trade, price);

        expect(result.triggered).toBe(false);
      });

      it('should NOT trigger SHORT when price is worse (lower) than entry', () => {
        const trade = createTrade({
          entry: 50000,
          side: TradeSide.SHORT,
          orderType: OrderType.LIMIT,
        });
        const price = createPrice({ bid: 49500 });

        const result = triggerDetector.checkEntryHit(trade, price);

        expect(result.triggered).toBe(false);
      });
    });
  });

  describe('State Transitions via Recovery', () => {
    it('should allow PENDING -> ACTIVE transition', () => {
      const trade = createTrade({ id: '1', status: TradeStatus.PENDING });
      const result = stateMachine.transition(trade, TradeStatus.ACTIVE);

      expect(result.success).toBe(true);
    });

    it('should NOT allow PENDING -> CLOSED_WIN directly', () => {
      const trade = createTrade({ id: '1', status: TradeStatus.PENDING });
      const result = stateMachine.transition(trade, TradeStatus.CLOSED_WIN);

      expect(result.success).toBe(false);
    });

    it('should NOT allow PENDING -> CLOSED_LOSS directly', () => {
      const trade = createTrade({ id: '1', status: TradeStatus.PENDING });
      const result = stateMachine.transition(trade, TradeStatus.CLOSED_LOSS);

      expect(result.success).toBe(false);
    });

    it('should allow ACTIVE -> PARTIAL_TP', () => {
      const trade = createTrade({ id: '1', status: TradeStatus.ACTIVE });
      const result = stateMachine.transition(trade, TradeStatus.PARTIAL_TP);

      expect(result.success).toBe(true);
    });

    it('should allow ACTIVE -> CLOSED_WIN (all TP hit)', () => {
      const trade = createTrade({ id: '1', status: TradeStatus.ACTIVE });
      const result = stateMachine.transition(trade, TradeStatus.CLOSED_WIN);

      expect(result.success).toBe(true);
    });

    it('should allow ACTIVE -> CLOSED_LOSS (SL hit)', () => {
      const trade = createTrade({ id: '1', status: TradeStatus.ACTIVE });
      const result = stateMachine.transition(trade, TradeStatus.CLOSED_LOSS);

      expect(result.success).toBe(true);
    });

    it('should NOT allow ACTIVE -> ACTIVE (same state)', () => {
      const trade = createTrade({ id: '1', status: TradeStatus.ACTIVE });
      const result = stateMachine.transition(trade, TradeStatus.ACTIVE);

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
        const trade = createTrade({ id: '1', status });
        const result = stateMachine.transition(trade, TradeStatus.ACTIVE);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Recovery Simulation', () => {
    it('should activate trade when entry conditions are met', () => {
      const trade = createTrade({
        id: 'recovery-test-1',
        entry: 50000,
        entryMax: 50100,
        side: TradeSide.LONG,
        orderType: OrderType.LIMIT,
        status: TradeStatus.PENDING,
        entryExecutedAt: null,
      });

      const price = createPrice({ ask: 50050 });
      const entryHit = triggerDetector.checkEntryHit(trade, price);

      expect(entryHit.triggered).toBe(true);
      expect(entryHit.trigger).toBe('entry');
      expect(entryHit.price).toBe(50050);

      const stateResult = stateMachine.activate(trade);
      expect(stateResult.success).toBe(true);
      expect(stateResult.newStatus).toBe(TradeStatus.ACTIVE);
    });

    it('should skip already executed trade (checked at recovery level, not trigger detection)', () => {
      const trade = createTrade({
        id: 'recovery-test-2',
        entry: 50000,
        side: TradeSide.LONG,
        orderType: OrderType.LIMIT,
        status: TradeStatus.PENDING,
        entryExecutedAt: new Date(),
        entryExecutedPrice: 49000,
      });

      const price = createPrice({ ask: 50000 });
      const entryHit = triggerDetector.checkEntryHit(trade, price);

      expect(entryHit.triggered).toBe(true);
    });

    it('should not activate when price is worse than entry (LIMIT waiting for better)', () => {
      const trade = createTrade({
        id: 'recovery-test-3',
        entry: 50000,
        entryMax: 50100,
        side: TradeSide.LONG,
        orderType: OrderType.LIMIT,
        status: TradeStatus.PENDING,
        entryExecutedAt: null,
      });

      const price = createPrice({ ask: 51000 });
      const entryHit = triggerDetector.checkEntryHit(trade, price);

      expect(entryHit.triggered).toBe(false);
    });

    it('should fill at better price for LONG LIMIT order', () => {
      const trade = createTrade({
        id: 'recovery-test-4',
        entry: 50000,
        side: TradeSide.LONG,
        orderType: OrderType.LIMIT,
        status: TradeStatus.PENDING,
        entryExecutedAt: null,
      });

      const price = createPrice({ ask: 49500 });
      const entryHit = triggerDetector.checkEntryHit(trade, price);

      expect(entryHit.triggered).toBe(true);
      expect(entryHit.trigger).toBe('entry');
      expect(entryHit.price).toBe(49500);
    });

    it('should fill at better price for SHORT LIMIT order', () => {
      const trade = createTrade({
        id: 'recovery-test-5',
        entry: 50000,
        side: TradeSide.SHORT,
        orderType: OrderType.LIMIT,
        status: TradeStatus.PENDING,
        entryExecutedAt: null,
      });

      const price = createPrice({ bid: 50500 });
      const entryHit = triggerDetector.checkEntryHit(trade, price);

      expect(entryHit.triggered).toBe(true);
      expect(entryHit.trigger).toBe('entry');
      expect(entryHit.price).toBe(50500);
    });

    it('should trigger when price is in entry range', () => {
      const trade = createTrade({
        id: 'recovery-test-6',
        entry: 50000,
        entryMax: 50100,
        side: TradeSide.LONG,
        orderType: OrderType.LIMIT,
        status: TradeStatus.PENDING,
        entryExecutedAt: null,
      });

      const price = createPrice({ ask: 50050 });
      const entryHit = triggerDetector.checkEntryHit(trade, price);

      expect(entryHit.triggered).toBe(true);
      expect(entryHit.trigger).toBe('entry');
    });
  });

  describe('Full Recovery Flow - Multiple Trades', () => {
    it('should process multiple trades independently', () => {
      const trades = [
        createTrade({ id: 'trade-1', entry: 50000, side: TradeSide.LONG, orderType: OrderType.LIMIT, entryMax: 50100 }),
        createTrade({ id: 'trade-2', entry: 3000, side: TradeSide.LONG, orderType: OrderType.LIMIT }),
        createTrade({ id: 'trade-3', entry: 100, side: TradeSide.SHORT, orderType: OrderType.LIMIT }),
      ];

      const prices = [
        createPrice({ symbol: 'BTCUSDT', ask: 50050 }),
        createPrice({ symbol: 'ETHUSDT', ask: 2990 }),
        createPrice({ symbol: 'BNBUSDT', bid: 105 }),
      ];

      const results = trades.map((trade, i) => {
        const price = prices[i];
        return triggerDetector.checkEntryHit(trade, price);
      });

      expect(results[0].triggered).toBe(true);
      expect(results[1].triggered).toBe(true);
      expect(results[2].triggered).toBe(true);
    });

    it('should skip trades with different conditions', () => {
      const trades = [
        createTrade({ id: 'trade-1', entry: 50000, entryExecutedAt: new Date() }),
        createTrade({ id: 'trade-2', entry: 50000, orderType: OrderType.MARKET }),
        createTrade({ id: 'trade-3', entry: 50000, status: TradeStatus.ACTIVE }),
        createTrade({ id: 'trade-4', entry: 50000, side: TradeSide.LONG, orderType: OrderType.LIMIT, entryMax: 50100 }),
      ];

      const price = createPrice({ ask: 50050 });

      const results = trades.map(trade => triggerDetector.checkEntryHit(trade, price));

      expect(results[0].triggered).toBe(false);
      expect(results[1].triggered).toBe(true);
      expect(results[2].triggered).toBe(false);
      expect(results[3].triggered).toBe(true);
    });
  });

  describe('TP and SL after Recovery', () => {
    it('should detect TP hit after recovery activates trade', () => {
      const trade = createTrade({
        status: TradeStatus.ACTIVE,
        entry: 50000,
        sl: 49000,
        tps: [52000, 54000],
      });

      const price = createPrice({ bid: 52000 });
      const result = triggerDetector.checkTPHit(trade, price);

      expect(result.triggered).toBe(true);
      expect(result.trigger).toBe('tp');
      expect(result.tpIndex).toBe(0);
      expect(result.rr).toBe(2);
    });

    it('should detect SL hit after recovery activates trade', () => {
      const trade = createTrade({
        status: TradeStatus.ACTIVE,
        entry: 50000,
        sl: 49000,
        tps: [52000],
      });

      const price = createPrice({ bid: 49000 });
      const result = triggerDetector.checkSLHit(trade, price);

      expect(result.triggered).toBe(true);
      expect(result.trigger).toBe('sl');
      expect(result.rr).toBe(-1);
    });

it('should skip already hit TP and detect next', () => {
      const trade = createTrade({
        status: TradeStatus.ACTIVE,
        tps: [52000, 54000],
        tpsHit: [0],
      });
      const price = createPrice({ bid: 54000 });

      const result = triggerDetector.checkTPHit(trade, price);

      expect(result.triggered).toBe(true);
      expect(result.tpIndex).toBe(1);
    });

    it('should detect all TPs hit -> CLOSED_WIN', () => {
      const trade = createTrade({
        status: TradeStatus.PARTIAL_TP,
        entry: 50000,
        sl: 49000,
        tps: [52000, 54000],
        tpsHit: [0],
      });

      const price = createPrice({ bid: 54000 });
      const result = triggerDetector.checkTPHit(trade, price);

      expect(result.triggered).toBe(true);
      expect(result.tpIndex).toBe(1);
      expect(result.rr).toBe(4);
    });
  });
});