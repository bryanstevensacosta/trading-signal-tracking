import { TriggerDetectorService, TriggerResult } from '../trigger-detector.service';
import { Trade, TradeStatus, TradeSide, Price, OrderType } from '@trade/shared';

describe('TriggerDetectorService', () => {
  let service: TriggerDetectorService;

  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    service = new TriggerDetectorService(mockLogger as any);
  });

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

  describe('checkEntryHit', () => {
    it('should detect entry hit for LONG trade when last is within entry range', () => {
      const trade = createTrade({ status: TradeStatus.PENDING, entry: 50000, entryMax: 50100 });
      const price = createPrice({ last: 50050 });

      const result = service.checkEntryHit(trade, price);

      expect(result.triggered).toBe(true);
      expect(result.trigger).toBe('entry');
      expect(result.price).toBe(50050);
    });

    it('should not detect entry hit for LONG when price above entryMax', () => {
      const trade = createTrade({ status: TradeStatus.PENDING, entry: 50000, entryMax: 50100 });
      const price = createPrice({ last: 50200 });

      const result = service.checkEntryHit(trade, price);

      expect(result.triggered).toBe(false);
    });

    it('should detect entry hit for SHORT trade when last is within entry range', () => {
      const trade = createTrade({ status: TradeStatus.PENDING, side: TradeSide.SHORT, entry: 50000, entryMax: 49900 });
      const price = createPrice({ last: 49950 });

      const result = service.checkEntryHit(trade, price);

      expect(result.triggered).toBe(true);
      expect(result.trigger).toBe('entry');
    });

    it('should not detect entry hit when trade is not pending', () => {
      const trade = createTrade({ status: TradeStatus.ACTIVE });
      const price = createPrice({ ask: 50050 });

      const result = service.checkEntryHit(trade, price);

      expect(result.triggered).toBe(false);
    });

    it('should use entry when entryMax is null', () => {
      const trade = createTrade({ status: TradeStatus.PENDING, entry: 50000, entryMax: null });
      const price = createPrice({ last: 50000 });

      const result = service.checkEntryHit(trade, price);

      expect(result.triggered).toBe(true);
    });
  });

  describe('checkTPHit', () => {
    it('should detect TP1 hit for LONG when bid reaches TP', () => {
      const trade = createTrade({ status: TradeStatus.ACTIVE });
      const price = createPrice({ bid: 52000 });

      const result = service.checkTPHit(trade, price);

      expect(result.triggered).toBe(true);
      expect(result.trigger).toBe('tp');
      expect(result.price).toBe(52000);
      expect(result.tpIndex).toBe(0);
    });

    it('should detect TP2 when TP1 is already hit', () => {
      const trade = createTrade({ status: TradeStatus.ACTIVE, tps: [52000, 54000], tpsHit: [0] });
      const price = createPrice({ bid: 54000 });

      const result = service.checkTPHit(trade, price);

      expect(result.triggered).toBe(true);
      expect(result.tpIndex).toBe(1);
    });

    it('should detect TP hit for SHORT when ask reaches TP', () => {
      const trade = createTrade({ status: TradeStatus.ACTIVE, side: TradeSide.SHORT });
      const price = createPrice({ ask: 48000 });

      const result = service.checkTPHit(trade, price);

      expect(result.triggered).toBe(true);
      expect(result.tpIndex).toBe(0);
    });

    it('should not detect TP hit when price has not reached TP', () => {
      const trade = createTrade({ status: TradeStatus.ACTIVE });
      const price = createPrice({ bid: 51000 });

      const result = service.checkTPHit(trade, price);

      expect(result.triggered).toBe(false);
    });

    it('should skip already hit TPs and detect next TP', () => {
      const trade = createTrade({ status: TradeStatus.ACTIVE, tps: [52000, 54000], tpsHit: [0] });
      const price = createPrice({ bid: 54000 });

      const result = service.checkTPHit(trade, price);

      expect(result.triggered).toBe(true);
      expect(result.tpIndex).toBe(1);
    });

    it('should return false when no TPs defined', () => {
      const trade = createTrade({ status: TradeStatus.ACTIVE, tps: null });
      const price = createPrice({ bid: 52000 });

      const result = service.checkTPHit(trade, price);

      expect(result.triggered).toBe(false);
    });

    it('should calculate RR when SL is defined', () => {
      const trade = createTrade({ status: TradeStatus.ACTIVE, entry: 50000, sl: 49000, tps: [52000] });
      const price = createPrice({ bid: 52000 });

      const result = service.checkTPHit(trade, price);

      expect(result.triggered).toBe(true);
      expect(result.rr).toBe(2);
    });
  });

  describe('checkSLHit', () => {
    it('should detect SL hit for LONG when bid drops to SL', () => {
      const trade = createTrade({ status: TradeStatus.ACTIVE });
      const price = createPrice({ bid: 49000 });

      const result = service.checkSLHit(trade, price);

      expect(result.triggered).toBe(true);
      expect(result.trigger).toBe('sl');
      expect(result.price).toBe(49000);
      expect(result.rr).toBe(-1);
    });

    it('should detect SL hit for SHORT when ask rises to SL', () => {
      const trade = createTrade({ status: TradeStatus.ACTIVE, side: TradeSide.SHORT });
      const price = createPrice({ ask: 51000 });

      const result = service.checkSLHit(trade, price);

      expect(result.triggered).toBe(true);
    });

    it('should not detect SL hit for LONG when bid is above SL', () => {
      const trade = createTrade({ status: TradeStatus.ACTIVE });
      const price = createPrice({ bid: 49500 });

      const result = service.checkSLHit(trade, price);

      expect(result.triggered).toBe(false);
    });

    it('should return false when no SL defined', () => {
      const trade = createTrade({ status: TradeStatus.ACTIVE, sl: null });
      const price = createPrice({ bid: 49000 });

      const result = service.checkSLHit(trade, price);

      expect(result.triggered).toBe(false);
    });
  });

  describe('checkAllTriggers', () => {
    it('should check entry first', () => {
      const trade = createTrade({ status: TradeStatus.PENDING, entry: 50000 });
      const price = createPrice({ last: 50000 });

      const result = service.checkAllTriggers(trade, price);

      expect(result.triggered).toBe(true);
      expect(result.trigger).toBe('entry');
    });

    it('should check TP before SL', () => {
      const trade = createTrade({ status: TradeStatus.ACTIVE, entry: 50000, sl: 49000, tps: [52000] });
      const price = createPrice({ bid: 52000, ask: 52000 });

      const result = service.checkAllTriggers(trade, price);

      expect(result.triggered).toBe(true);
      expect(result.trigger).toBe('tp');
    });

    it('should return not triggered when no conditions met', () => {
      const trade = createTrade({ status: TradeStatus.ACTIVE });
      const price = createPrice({ bid: 51000 });

      const result = service.checkAllTriggers(trade, price);

      expect(result.triggered).toBe(false);
    });
  });
});