import fc from 'fast-check';
import { TradingEngineService } from '../trading-engine.service';
import { SqliteTradeAdapter } from '@trade/repository/infrastructure/adapters/sqlite-trade.adapter';
import { PriceStreamService } from '@price/stream/domain/services/price-stream.service';
import { TriggerDetectorService } from '../trigger-detector.service';
import { EventBus, CommandBus } from '@nestjs/cqrs';
import { Trade, TradeStatus, TradeSide, Price, OrderType } from '@trade/shared';

describe('TradingEngineService (property-based)', () => {
  let engine: TradingEngineService;
  let mockRepository: jest.Mocked<SqliteTradeAdapter>;
  let mockPriceStream: jest.Mocked<PriceStreamService>;
  let mockTriggerDetector: jest.Mocked<TriggerDetectorService>;
  let mockRecoveryService: any;
  let mockEventBus: jest.Mocked<EventBus>;
  let mockCommandBus: jest.Mocked<CommandBus>;
  let mockLogger: any;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findActive: jest.fn(),
      findPending: jest.fn(),
      findByStatus: jest.fn(),
      findBySymbol: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockPriceStream = {
      subscribe: jest.fn().mockReturnValue({ symbol: 'BTCUSDT', unsubscribe: jest.fn(), subscribedAt: new Date() }),
      unsubscribe: jest.fn(),
      unsubscribeAll: jest.fn(),
      getActiveSubscriptions: jest.fn(),
      isSubscribed: jest.fn(),
    } as any;

    mockTriggerDetector = {
      checkEntryHit: jest.fn(),
      checkTPHit: jest.fn(),
      checkSLHit: jest.fn(),
      checkAllTriggers: jest.fn(),
    } as any;

    mockRecoveryService = {
      recoverMissedTriggers: jest.fn().mockResolvedValue(new Map()),
    } as any;

    mockEventBus = {
      publish: jest.fn(),
    } as any;

    mockCommandBus = {
      execute: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    engine = new TradingEngineService(
      mockRepository as any,
      mockPriceStream,
      mockTriggerDetector,
      mockRecoveryService,
      mockEventBus,
      mockCommandBus,
      mockLogger,
    );
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
    notificationMessageId: null,
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

  describe('startMonitoring - symbol normalization', () => {
    it('should normalize symbol to uppercase', async () => {
      const trade = createTrade({ symbol: 'btcusdt' });

      await engine.startMonitoring(trade);

      expect(mockPriceStream.subscribe).toHaveBeenCalledWith(
        'BTCUSDT',
        expect.any(Function),
        'futures'
      );
    });

    it('should handle mixed case symbols', async () => {
      const trade = createTrade({ symbol: 'BtcUsdt' });

      await engine.startMonitoring(trade);

      expect(mockPriceStream.subscribe).toHaveBeenCalledWith(
        'BTCUSDT',
        expect.any(Function),
        'futures'
      );
    });
  });

  describe('onPriceUpdateForSymbol - trigger detection', () => {
    it('should check all active trades for trigger', async () => {
      const trades = [
        createTrade({ id: '1', status: TradeStatus.ACTIVE }),
        createTrade({ id: '2', status: TradeStatus.ACTIVE }),
      ];
      mockRepository.findBySymbol.mockResolvedValue(trades);
      mockTriggerDetector.checkAllTriggers.mockReturnValue({ triggered: false });

      const price = createPrice();
      await engine.onPriceUpdateForSymbol('BTCUSDT', price);

      expect(mockTriggerDetector.checkAllTriggers).toHaveBeenCalledTimes(2);
    });

    it('should skip non-active trades', async () => {
      const trades = [
        createTrade({ id: '1', status: TradeStatus.CLOSED_WIN }),
        createTrade({ id: '2', status: TradeStatus.CLOSED_LOSS }),
      ];
      mockRepository.findBySymbol.mockResolvedValue(trades);

      const price = createPrice();
      await engine.onPriceUpdateForSymbol('BTCUSDT', price);

      expect(mockTriggerDetector.checkAllTriggers).not.toHaveBeenCalled();
    });

    it('should process all monitored statuses', async () => {
      const trades = [
        createTrade({ id: '1', status: TradeStatus.PENDING }),
        createTrade({ id: '2', status: TradeStatus.ACTIVE }),
        createTrade({ id: '3', status: TradeStatus.PARTIAL_TP }),
        createTrade({ id: '4', status: TradeStatus.BREAKEVEN }),
      ];
      mockRepository.findBySymbol.mockResolvedValue(trades);
      mockTriggerDetector.checkAllTriggers.mockReturnValue({ triggered: false });

      const price = createPrice();
      await engine.onPriceUpdateForSymbol('BTCUSDT', price);

      expect(mockTriggerDetector.checkAllTriggers).toHaveBeenCalledTimes(4);
    });
  });

  describe('monitoring state', () => {
    it('should track monitored symbols', async () => {
      const trade = createTrade({ symbol: 'BTCUSDT' });

      await engine.startMonitoring(trade);

      expect(engine.getMonitoredSymbols()).toContain('BTCUSDT-futures');
    });

    it('should check if symbol is being monitored', async () => {
      const trade = createTrade({ symbol: 'BTCUSDT' });

      expect(engine.isMonitoring('BTCUSDT')).toBe(false);

      await engine.startMonitoring(trade);

      expect(engine.isMonitoring('BTCUSDT')).toBe(true);
    });

    it('isMonitoring should be case insensitive', async () => {
      const trade = createTrade({ symbol: 'btcusdt' });

      await engine.startMonitoring(trade);

      expect(engine.isMonitoring('BTCUSDT')).toBe(true);
      expect(engine.isMonitoring('btcusdt')).toBe(true);
    });
  });

  describe('trigger detection results', () => {
    it('should publish event when trigger detected', async () => {
      const trade = createTrade({ status: TradeStatus.ACTIVE });
      const price = createPrice();
      mockRepository.findBySymbol.mockResolvedValue([trade]);
      mockTriggerDetector.checkAllTriggers.mockReturnValue({
        triggered: true,
        trigger: 'tp' as any,
        price: 52000,
        rr: 2,
        tpIndex: 0,
      });

      await engine.onPriceUpdateForSymbol('BTCUSDT', price);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          trade,
          trigger: 'tp',
          price: 52000,
        })
      );
    });

    it('should not publish event when no trigger', async () => {
      const trade = createTrade({ status: TradeStatus.ACTIVE });
      const price = createPrice();
      mockRepository.findBySymbol.mockResolvedValue([trade]);
      mockTriggerDetector.checkAllTriggers.mockReturnValue({ triggered: false });

      await engine.onPriceUpdateForSymbol('BTCUSDT', price);

      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('startMonitoringAll', () => {
    it('should subscribe to unique symbols from all trades', async () => {
      const pendingTrades = [
        createTrade({ id: '1', symbol: 'BTCUSDT', status: TradeStatus.PENDING }),
        createTrade({ id: '2', symbol: 'ETHUSDT', status: TradeStatus.PENDING }),
      ];
      const activeTrades = [
        createTrade({ id: '3', symbol: 'SOLUSDT', status: TradeStatus.ACTIVE }),
      ];
      mockRepository.findPending.mockResolvedValue(pendingTrades);
      mockRepository.findActive.mockResolvedValue(activeTrades);

      await engine.startMonitoringAll();

      expect(mockPriceStream.subscribe).toHaveBeenCalledTimes(3);
    });

    it('should deduplicate symbols across pending and active', async () => {
      const pendingTrades = [createTrade({ id: '1', symbol: 'BTCUSDT', status: TradeStatus.PENDING })];
      const activeTrades = [createTrade({ id: '2', symbol: 'BTCUSDT', status: TradeStatus.ACTIVE })];
      mockRepository.findPending.mockResolvedValue(pendingTrades);
      mockRepository.findActive.mockResolvedValue(activeTrades);

      await engine.startMonitoringAll();

      expect(mockPriceStream.subscribe).toHaveBeenCalledTimes(1);
    });
  });
});