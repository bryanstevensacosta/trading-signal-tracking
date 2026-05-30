import { Test, TestingModule } from '@nestjs/testing';
import { PriceStreamModule } from '../../src/price/stream/price-stream.module';
import { PriceStreamService } from '../../src/price/stream/domain/services/price-stream.service';
import { BinanceExchangeAdapter } from '../../src/price/exchange/infrastructure/adapters/binance.adapter';
import { EventBus } from '@nestjs/cqrs';

describe.skip('PriceStreamModule (e2e)', () => {
  let module: TestingModule;
  let service: PriceStreamService;
  let mockSubscribeToTicker: jest.Mock;

  beforeAll(async () => {
    mockSubscribeToTicker = jest.fn();

    module = await Test.createTestingModule({
      imports: [PriceStreamModule],
    })
      .overrideProvider(BinanceExchangeAdapter)
      .useValue({
        subscribeToTicker: mockSubscribeToTicker,
        connect: jest.fn(),
        disconnect: jest.fn(),
        isConnected: jest.fn(),
        getTicker: jest.fn(),
        getMultipleTickers: jest.fn(),
        subscribeToMultipleTickers: jest.fn(),
        getConfig: jest.fn().mockReturnValue({
          name: 'binance',
          restUrl: 'https://api.binance.com',
          wsUrl: 'wss://stream.binance.com:9443',
          testnet: false,
        }),
      })
      .compile();

    service = module.get<PriceStreamService>(PriceStreamService);
  });

  afterAll(async () => {
    service.unsubscribeAll();
    await module.close();
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
    beforeEach(() => {
      service.unsubscribeAll();
    });

    it('should subscribe to symbol', () => {
      mockSubscribeToTicker.mockReturnValue(jest.fn());

      const result = service.subscribe('BTCUSDT', jest.fn());

      expect(result.symbol).toBe('BTCUSDT');
      expect(result.unsubscribe).toBeDefined();
      expect(result.subscribedAt).toBeInstanceOf(Date);
    });

    it('should return existing subscription', () => {
      mockSubscribeToTicker.mockReturnValue(jest.fn());

      const result1 = service.subscribe('BTCUSDT', jest.fn());
      const result2 = service.subscribe('BTCUSDT', jest.fn());

      expect(result1).toBe(result2);
    });

    it('should track active subscriptions', () => {
      mockSubscribeToTicker.mockReturnValue(jest.fn());

      service.subscribe('BTCUSDT', jest.fn());
      service.subscribe('ETHUSDT', jest.fn());

      expect(service.getActiveSubscriptions()).toContain('BTCUSDT');
      expect(service.getActiveSubscriptions()).toContain('ETHUSDT');
    });

    it('should unsubscribe from symbol', () => {
      const unsubscribe = jest.fn();
      mockSubscribeToTicker.mockReturnValue(unsubscribe);

      service.subscribe('BTCUSDT', jest.fn());
      service.unsubscribe('BTCUSDT');

      expect(unsubscribe).toHaveBeenCalled();
    });

    it('should unsubscribe all symbols', () => {
      const unsub1 = jest.fn();
      const unsub2 = jest.fn();
      mockSubscribeToTicker.mockReturnValueOnce(unsub1);
      mockSubscribeToTicker.mockReturnValueOnce(unsub2);

      service.subscribe('BTCUSDT', jest.fn());
      service.subscribe('ETHUSDT', jest.fn());
      service.unsubscribeAll();

      expect(unsub1).toHaveBeenCalled();
      expect(unsub2).toHaveBeenCalled();
      expect(service.getActiveSubscriptions()).toEqual([]);
    });
  });
});