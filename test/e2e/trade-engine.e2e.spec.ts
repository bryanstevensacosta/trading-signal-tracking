import { TriggerDetectorService, TriggerResult } from '../../src/trade/trigger/domain/services/trigger-detector.service';
import { TriggerOrchestratorService } from '../../src/trade/trigger/domain/services/trigger-orchestrator.service';
import { Trade, TradeStatus, TradeSide, Price, OrderType } from '../../src/trade/shared';

describe('Trade Engine (e2e)', () => {
  let triggerDetector: TriggerDetectorService;
  let tradingEngine: TriggerOrchestratorService;

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
  });

  describe('Trigger Detection', () => {
    describe('Entry Hit Detection', () => {
      it('should detect entry hit for LONG when price enters range', () => {
        const trade = createTrade({ status: TradeStatus.PENDING, entry: 50000, entryMax: 50100 });
        const price = createPrice({ ask: 50050 });

        const result = triggerDetector.checkEntryHit(trade, price);

        expect(result.triggered).toBe(true);
        expect(result.trigger).toBe('entry');
      });

      it('should detect entry hit for SHORT when price enters range', () => {
        const trade = createTrade({
          status: TradeStatus.PENDING,
          side: TradeSide.SHORT,
          entry: 50000,
          entryMax: 49900,
        });
        const price = createPrice({ bid: 49950, ask: 49951, last: 49950 });

        const result = triggerDetector.checkEntryHit(trade, price);

        expect(result.triggered).toBe(true);
        expect(result.trigger).toBe('entry');
      });

      it('should not detect entry for non-pending trades', () => {
        const trade = createTrade({ status: TradeStatus.ACTIVE });
        const price = createPrice({ ask: 50050 });

        const result = triggerDetector.checkEntryHit(trade, price);

        expect(result.triggered).toBe(false);
      });
    });

    describe('TP Hit Detection', () => {
      it('should detect TP1 hit for LONG', () => {
        const trade = createTrade({ status: TradeStatus.ACTIVE });
        const price = createPrice({ bid: 52000 });

        const result = triggerDetector.checkTPHit(trade, price);

        expect(result.triggered).toBe(true);
        expect(result.trigger).toBe('tp');
        expect(result.tpIndex).toBe(0);
      });

      it('should detect TP1 hit and calculate RR (first TP not yet hit)', () => {
        const trade = createTrade({
          status: TradeStatus.ACTIVE,
          entry: 50000,
          sl: 49000,
          tps: [52000, 54000],
        });
        const price = createPrice({ bid: 54000 });

        const result = triggerDetector.checkTPHit(trade, price);

        expect(result.triggered).toBe(true);
        expect(result.tpIndex).toBe(0);
        expect(result.rr).toBe(2);
      });

      it('should skip already hit TPs and detect next', () => {
        const trade = createTrade({
          status: TradeStatus.ACTIVE,
          entry: 50000,
          sl: 49000,
          tps: [52000, 54000],
          tpsHit: [0],
        });
        const price = createPrice({ bid: 54000 });

        const result = triggerDetector.checkTPHit(trade, price);

        expect(result.triggered).toBe(true);
        expect(result.tpIndex).toBe(1);
      });
    });

    describe('SL Hit Detection', () => {
      it('should detect SL hit for LONG', () => {
        const trade = createTrade({ status: TradeStatus.ACTIVE });
        const price = createPrice({ bid: 49000 });

        const result = triggerDetector.checkSLHit(trade, price);

        expect(result.triggered).toBe(true);
        expect(result.trigger).toBe('sl');
        expect(result.rr).toBe(-1);
      });

      it('should detect SL hit for SHORT', () => {
        const trade = createTrade({ status: TradeStatus.ACTIVE, side: TradeSide.SHORT });
        const price = createPrice({ ask: 51000 });

        const result = triggerDetector.checkSLHit(trade, price);

        expect(result.triggered).toBe(true);
        expect(result.trigger).toBe('sl');
      });
    });

    describe('Trigger Priority', () => {
      it('should prioritize entry over TP', () => {
        const trade = createTrade({
          status: TradeStatus.PENDING,
          entry: 50000,
          entryMax: 50000,
          tps: [50000],
        });
        const price = createPrice({ ask: 50000, bid: 50000, last: 50000 });

        const result = triggerDetector.checkAllTriggers(trade, price);

        expect(result.trigger).toBe('entry');
      });

      it('should prioritize TP over SL', () => {
        const trade = createTrade({
          status: TradeStatus.ACTIVE,
          entry: 50000,
          sl: 49000,
          tps: [52000],
        });
        const price = createPrice({ bid: 52000, ask: 52000 });

        const result = triggerDetector.checkAllTriggers(trade, price);

        expect(result.trigger).toBe('tp');
      });
    });
  });

  describe('Trigger Result', () => {
    it('should include tpIndex when TP is hit', () => {
      const trade = createTrade({
        status: TradeStatus.ACTIVE,
        tps: [52000, 54000],
        tpsHit: [0],
      });
      const price = createPrice({ bid: 54000 });

      const result = triggerDetector.checkTPHit(trade, price);

      expect(result.tpIndex).toBe(1);
    });

    it('should include RR for TP hits', () => {
      const trade = createTrade({
        status: TradeStatus.ACTIVE,
        entry: 50000,
        sl: 49000,
        tps: [52000],
      });
      const price = createPrice({ bid: 52000 });

      const result = triggerDetector.checkTPHit(trade, price);

      expect(result.rr).toBe(2);
    });

    it('should include RR = -1 for SL hits', () => {
      const trade = createTrade({ status: TradeStatus.ACTIVE });
      const price = createPrice({ bid: 49000 });

      const result = triggerDetector.checkSLHit(trade, price);

      expect(result.rr).toBe(-1);
    });
  });
});