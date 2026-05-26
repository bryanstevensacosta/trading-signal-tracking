import { PriceStreamService } from '../price-stream.service';
import { MarketType } from '@trade/shared';

describe('PriceStreamService', () => {
  let service: PriceStreamService;
  let mockSubscribeToTicker: jest.Mock;
  let mockPublish: jest.Mock;
  let mockAdapter: Record<string, unknown>;

  beforeEach(() => {
    mockSubscribeToTicker = jest.fn();
    mockPublish = jest.fn();

    mockAdapter = {
      subscribeToTicker: mockSubscribeToTicker,
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      isConnected: jest.fn().mockReturnValue(true),
      getTicker: jest.fn(),
      getMultipleTickers: jest.fn(),
      subscribeToMultipleTickers: jest.fn(),
      getConfig: jest.fn().mockReturnValue({
        name: 'binance',
        restUrl: 'https://api.binance.com',
        wsUrl: 'wss://stream.binance.com',
        testnet: false,
        marketType: MarketType.SPOT,
      }),
      symbolExists: jest.fn().mockResolvedValue(true),
    };

    service = new PriceStreamService(mockAdapter as any, { publish: mockPublish } as any);
  });

  afterEach(() => {
    if (service) {
      service.unsubscribeAll();
    }
  });

  describe('subscribe', () => {
    it('should create subscription for new symbol', () => {
      const unsubscribe = jest.fn();
      mockSubscribeToTicker.mockReturnValue(unsubscribe);

      const callback = jest.fn();
      const result = service.subscribe('BTCUSDT', callback);

      expect(result.symbol).toBe('BTCUSDT');
      expect(result.unsubscribe).toBe(unsubscribe);
      expect(result.subscribedAt).toBeInstanceOf(Date);
    });

    it('should return existing subscription for same symbol', () => {
      const unsubscribe = jest.fn();
      mockSubscribeToTicker.mockReturnValue(unsubscribe);

      const callback = jest.fn();
      const result1 = service.subscribe('BTCUSDT', callback);
      const result2 = service.subscribe('BTCUSDT', callback);

      expect(result1).toBe(result2);
      expect(mockSubscribeToTicker).toHaveBeenCalledTimes(1);
    });

    it('should normalize symbol to uppercase', () => {
      const unsubscribe = jest.fn();
      mockSubscribeToTicker.mockReturnValue(unsubscribe);

      const callback = jest.fn();
      service.subscribe('btcusdt', callback);

      expect(mockSubscribeToTicker).toHaveBeenCalledWith('BTCUSDT', expect.any(Function));
    });

    it('should publish PriceUpdatedEvent on price update', async () => {
      const unsubscribe = jest.fn();
      mockSubscribeToTicker.mockReturnValue(unsubscribe);
      mockPublish.mockResolvedValue(undefined);

      const callback = jest.fn();
      service.subscribe('BTCUSDT', callback);

      const priceCallback = mockSubscribeToTicker.mock.calls[0][1];
      const mockPrice = {
        symbol: 'BTCUSDT',
        bid: 50000,
        ask: 50001,
        last: 50000.5,
        timestamp: new Date(),
        exchange: 'binance',
        marketType: MarketType.SPOT,
      };

      await priceCallback(mockPrice);

      expect(mockPublish).toHaveBeenCalledWith(expect.objectContaining({
        price: mockPrice,
      }));
    });
  });

  describe('unsubscribe', () => {
    it('should call unsubscribe function', () => {
      const unsubscribe = jest.fn();
      mockSubscribeToTicker.mockReturnValue(unsubscribe);

      service.subscribe('BTCUSDT', jest.fn());
      service.unsubscribe('BTCUSDT');

      expect(unsubscribe).toHaveBeenCalled();
    });

    it('should not throw for non-subscribed symbol', () => {
      expect(() => service.unsubscribe('NONEXISTENT')).not.toThrow();
    });
  });

  describe('unsubscribeAll', () => {
    it('should unsubscribe from all symbols', () => {
      const unsub1 = jest.fn();
      const unsub2 = jest.fn();
      mockSubscribeToTicker.mockReturnValueOnce(unsub1).mockReturnValueOnce(unsub2);

      service.subscribe('BTCUSDT', jest.fn());
      service.subscribe('ETHUSDT', jest.fn());
      service.unsubscribeAll();

      expect(unsub1).toHaveBeenCalled();
      expect(unsub2).toHaveBeenCalled();
      expect(service.getActiveSubscriptions()).toEqual([]);
    });
  });

  describe('getActiveSubscriptions', () => {
    it('should return all subscribed symbols', () => {
      mockSubscribeToTicker.mockReturnValueOnce(jest.fn());
      mockSubscribeToTicker.mockReturnValueOnce(jest.fn());

      service.subscribe('BTCUSDT', jest.fn());
      service.subscribe('ETHUSDT', jest.fn());

      expect(service.getActiveSubscriptions()).toEqual(['BTCUSDT', 'ETHUSDT']);
    });

    it('should return empty array when no subscriptions', () => {
      expect(service.getActiveSubscriptions()).toEqual([]);
    });
  });

  describe('isSubscribed', () => {
    it('should return true for subscribed symbol', () => {
      mockSubscribeToTicker.mockReturnValue(jest.fn());
      service.subscribe('BTCUSDT', jest.fn());

      expect(service.isSubscribed('BTCUSDT')).toBe(true);
    });

    it('should return false for non-subscribed symbol', () => {
      expect(service.isSubscribed('NONEXISTENT')).toBe(false);
    });

    it('should be case insensitive', () => {
      mockSubscribeToTicker.mockReturnValue(jest.fn());
      service.subscribe('BTCUSDT', jest.fn());

      expect(service.isSubscribed('btcusdt')).toBe(true);
    });
  });
});