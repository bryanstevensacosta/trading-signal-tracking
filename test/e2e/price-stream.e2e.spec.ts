import { Test, TestingModule } from '@nestjs/testing';
import { PriceStreamService, MarketType } from '../../src/price/stream/domain/services/price-stream.service';
import { SPOT_PORT, FUTURES_PORT } from '../../src/price/provider/binance/tokens';
import { EventBus } from '@nestjs/cqrs';
import { Price } from '@trade/shared';

describe('PriceStreamModule (e2e)', () => {
  let module: TestingModule;
  let service: PriceStreamService;
  let mockSubscribeToTicker: jest.Mock;

  const mockLogger = {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  };

  const mockSpotExchange = {
    subscribeToTicker: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockReturnValue(true),
    getTicker: jest.fn(),
    getMultipleTickers: jest.fn(),
    subscribeToMultipleTickers: jest.fn(),
  };

  const mockFuturesExchange = {
    subscribeToTicker: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockReturnValue(true),
    getTicker: jest.fn(),
    getMultipleTickers: jest.fn(),
    subscribeToMultipleTickers: jest.fn(),
  };

  beforeAll(async () => {
    mockSubscribeToTicker = jest.fn().mockReturnValue(jest.fn());

    module = await Test.createTestingModule({
      providers: [
        PriceStreamService,
        { provide: SPOT_PORT, useValue: mockSpotExchange },
        { provide: FUTURES_PORT, useValue: mockFuturesExchange },
        { provide: EventBus, useValue: { publish: jest.fn() } },
        { provide: 'LOGGER_PORT', useValue: mockLogger },
      ],
    }).compile();

    service = module.get<PriceStreamService>(PriceStreamService);
  });

  afterAll(async () => {
    service.unsubscribeAll();
    await module.close();
  });

  beforeEach(() => {
    service.unsubscribeAll();
    mockSubscribeToTicker.mockClear();
    mockSpotExchange.subscribeToTicker.mockClear();
    mockFuturesExchange.subscribeToTicker.mockClear();
  });

  describe('Module Integration', () => {
    it('should create the module', () => {
      expect(module).toBeDefined();
    });

    it('should provide PriceStreamService', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(PriceStreamService);
    });

    it('should have all PriceStreamPort methods', () => {
      expect(typeof service.subscribe).toBe('function');
      expect(typeof service.unsubscribe).toBe('function');
      expect(typeof service.unsubscribeAll).toBe('function');
      expect(typeof service.getActiveSubscriptions).toBe('function');
      expect(typeof service.isSubscribed).toBe('function');
    });
  });

  describe('Subscription Management', () => {
    it('should subscribe to symbol', () => {
      const unsubscribe = jest.fn();
      mockSpotExchange.subscribeToTicker.mockReturnValue(unsubscribe);

      const result = service.subscribe('BTCUSDT', jest.fn());

      expect(result.symbol).toBe('BTCUSDT');
      expect(result.unsubscribe).toBeDefined();
      expect(result.subscribedAt).toBeInstanceOf(Date);
    });

    it('should return existing subscription', () => {
      const unsubscribe = jest.fn();
      mockSpotExchange.subscribeToTicker.mockReturnValue(unsubscribe);

      const result1 = service.subscribe('BTCUSDT', jest.fn());
      const result2 = service.subscribe('BTCUSDT', jest.fn());

      expect(result1).toBe(result2);
    });

    it('should track active subscriptions', () => {
      const unsubscribe = jest.fn();
      mockSpotExchange.subscribeToTicker.mockReturnValue(unsubscribe);

      service.subscribe('BTCUSDT', jest.fn());
      service.subscribe('ETHUSDT', jest.fn());

      expect(service.getActiveSubscriptions()).toContain('BTCUSDT');
      expect(service.getActiveSubscriptions()).toContain('ETHUSDT');
    });

    it('should unsubscribe from symbol', () => {
      const unsubscribe = jest.fn();
      mockSpotExchange.subscribeToTicker.mockReturnValue(unsubscribe);

      service.subscribe('BTCUSDT', jest.fn());
      service.unsubscribe('BTCUSDT');

      expect(unsubscribe).toHaveBeenCalled();
    });

    it('should unsubscribe all symbols', () => {
      const unsub1 = jest.fn();
      const unsub2 = jest.fn();
      mockSpotExchange.subscribeToTicker.mockReturnValueOnce(unsub1);
      mockSpotExchange.subscribeToTicker.mockReturnValueOnce(unsub2);

      service.subscribe('BTCUSDT', jest.fn());
      service.subscribe('ETHUSDT', jest.fn());
      service.unsubscribeAll();

      expect(unsub1).toHaveBeenCalled();
      expect(unsub2).toHaveBeenCalled();
      expect(service.getActiveSubscriptions()).toEqual([]);
    });
  });
});
