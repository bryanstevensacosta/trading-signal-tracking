import { EventBus, CommandBus } from '@nestjs/cqrs';
import { TradingEngineService } from '../trading-engine.service';
import { SqliteTradeAdapter } from '@trade/repository/infrastructure/adapters/sqlite-trade.adapter';
import { PriceStreamService } from '@price/stream/domain/services/price-stream.service';
import { TriggerDetectorService } from '../trigger-detector.service';
import { Trade, TradeStatus, TradeSide, Price, TriggerType, OrderType } from '@trade/shared';

describe('TradingEngineService', () => {
  let engine: TradingEngineService;
  let mockRepository: jest.Mocked<SqliteTradeAdapter>;
  let mockPriceStream: jest.Mocked<PriceStreamService>;
  let mockTriggerDetector: jest.Mocked<TriggerDetectorService>;
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

  describe('startMonitoring', () => {
    it('should subscribe to symbol and add to monitored symbols', async () => {
      const trade = createTrade();

      await engine.startMonitoring(trade);

      expect(mockPriceStream.subscribe).toHaveBeenCalledWith(
        'BTCUSDT',
        expect.any(Function)
      );
      expect(engine.getMonitoredSymbols()).toContain('BTCUSDT');
    });

    it('should not subscribe twice for same symbol', async () => {
      const trade = createTrade();

      await engine.startMonitoring(trade);
      await engine.startMonitoring(trade);

      expect(mockPriceStream.subscribe).toHaveBeenCalledTimes(1);
    });

    it('should publish MonitoringStartedEvent', async () => {
      const trade = createTrade();

      await engine.startMonitoring(trade);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          trade,
        })
      );
    });
  });

  describe('stopMonitoring', () => {
    it('should unsubscribe when no other trades on symbol', async () => {
      const trade = createTrade();
      mockRepository.findBySymbol.mockResolvedValue([]);
      const unsubscribe = jest.fn();
      (engine as any).priceCallbacks.set('BTCUSDT', unsubscribe);

      await engine.stopMonitoring(trade);

      expect(mockPriceStream.unsubscribe).toHaveBeenCalledWith('BTCUSDT');
    });

    it('should keep subscription when other trades exist', async () => {
      const trade = createTrade({ id: 'trade1' });
      const otherTrade = createTrade({ id: 'trade2' });
      mockRepository.findBySymbol.mockResolvedValue([otherTrade]);

      await engine.stopMonitoring(trade);

      expect(mockPriceStream.unsubscribe).not.toHaveBeenCalled();
    });

    it('should publish MonitoringStoppedEvent', async () => {
      const trade = createTrade();
      mockRepository.findBySymbol.mockResolvedValue([]);

      await engine.stopMonitoring(trade, 'test_reason');

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          trade,
          reason: 'test_reason',
        })
      );
    });
  });

  describe('startMonitoringAll', () => {
    it('should subscribe to all symbols from active and pending trades', async () => {
      const pendingTrade = createTrade({ symbol: 'BTCUSDT', status: TradeStatus.PENDING });
      const activeTrade = createTrade({ symbol: 'ETHUSDT', status: TradeStatus.ACTIVE });
      mockRepository.findActive.mockResolvedValue([activeTrade]);
      mockRepository.findPending.mockResolvedValue([pendingTrade]);

      await engine.startMonitoringAll();

      expect(mockPriceStream.subscribe).toHaveBeenCalledTimes(2);
    });

    it('should deduplicate symbols', async () => {
      const trade1 = createTrade({ symbol: 'BTCUSDT' });
      const trade2 = createTrade({ symbol: 'BTCUSDT' });
      mockRepository.findActive.mockResolvedValue([trade1]);
      mockRepository.findPending.mockResolvedValue([trade2]);

      await engine.startMonitoringAll();

      expect(mockPriceStream.subscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('onPriceUpdateForSymbol', () => {
    it('should check all triggers for each monitored trade', async () => {
      const trade = createTrade({ status: TradeStatus.ACTIVE });
      const price = createPrice();
      mockRepository.findBySymbol.mockResolvedValue([trade]);
      mockTriggerDetector.checkAllTriggers.mockReturnValue({ triggered: false });

      await engine.onPriceUpdateForSymbol('BTCUSDT', price);

      expect(mockTriggerDetector.checkAllTriggers).toHaveBeenCalledWith(trade, price);
    });

    it('should skip closed trades', async () => {
      const closedTrade = createTrade({ status: TradeStatus.CLOSED_WIN });
      mockRepository.findBySymbol.mockResolvedValue([closedTrade]);

      await engine.onPriceUpdateForSymbol('BTCUSDT', createPrice());

      expect(mockTriggerDetector.checkAllTriggers).not.toHaveBeenCalled();
    });

    it('should publish TriggerDetectedEvent when trigger is hit', async () => {
      const trade = createTrade({ status: TradeStatus.ACTIVE });
      const price = createPrice();
      mockRepository.findBySymbol.mockResolvedValue([trade]);
      mockTriggerDetector.checkAllTriggers.mockReturnValue({
        triggered: true,
        trigger: TriggerType.TP,
        price: 52000,
        rr: 2,
        tpIndex: 0,
      });

      await engine.onPriceUpdateForSymbol('BTCUSDT', price);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          trade,
          trigger: TriggerType.TP,
          price: 52000,
        })
      );
    });
  });

  describe('getMonitoredSymbols', () => {
    it('should return empty array when no symbols monitored', () => {
      expect(engine.getMonitoredSymbols()).toEqual([]);
    });

    it('should return all monitored symbols', async () => {
      const trade = createTrade({ symbol: 'BTCUSDT' });

      await engine.startMonitoring(trade);

      expect(engine.getMonitoredSymbols()).toEqual(['BTCUSDT']);
    });
  });

  describe('isMonitoring', () => {
    it('should return false for non-monitored symbol', () => {
      expect(engine.isMonitoring('BTCUSDT')).toBe(false);
    });

    it('should return true for monitored symbol', async () => {
      const trade = createTrade({ symbol: 'BTCUSDT' });

      await engine.startMonitoring(trade);

      expect(engine.isMonitoring('BTCUSDT')).toBe(true);
    });
  });
});