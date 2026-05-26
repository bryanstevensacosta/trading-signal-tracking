import { SubscribeSymbolsHandler } from '../handler';
import { SubscribeSymbolsCommand } from '../command';
import { PriceStreamService } from '../../../../domain/services/price-stream.service';
import { PriceStreamPort } from '../../../../domain/ports/price-stream.port';

describe('SubscribeSymbolsHandler', () => {
  const mockSubscribe = jest.fn();
  const mockPriceStream: PriceStreamPort = {
    subscribe: mockSubscribe,
    unsubscribe: jest.fn(),
    unsubscribeAll: jest.fn(),
    getActiveSubscriptions: jest.fn(),
    isSubscribed: jest.fn(),
  } as unknown as PriceStreamPort;

  const handler = new SubscribeSymbolsHandler(mockPriceStream as unknown as PriceStreamService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should subscribe to single symbol', async () => {
      mockSubscribe.mockReturnValue({
        symbol: 'BTCUSDT',
        unsubscribe: jest.fn(),
        subscribedAt: new Date(),
      });

      const command = new SubscribeSymbolsCommand(['BTCUSDT']);
      const result = await handler.execute(command);

      expect(result.symbols).toContain('BTCUSDT');
      expect(result.subscriptions).toHaveLength(1);
      expect(mockSubscribe).toHaveBeenCalledWith('BTCUSDT', expect.any(Function));
    });

    it('should subscribe to multiple symbols', async () => {
      mockSubscribe.mockReturnValue({
        symbol: 'BTCUSDT',
        unsubscribe: jest.fn(),
        subscribedAt: new Date(),
      });

      const command = new SubscribeSymbolsCommand(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
      const result = await handler.execute(command);

      expect(result.symbols).toHaveLength(3);
      expect(result.subscriptions).toHaveLength(3);
      expect(mockSubscribe).toHaveBeenCalledTimes(3);
    });

    it('should return subscription info with subscribedAt', async () => {
      const now = new Date();
      mockSubscribe.mockReturnValue({
        symbol: 'BTCUSDT',
        unsubscribe: jest.fn(),
        subscribedAt: now,
      });

      const command = new SubscribeSymbolsCommand(['BTCUSDT']);
      const result = await handler.execute(command);

      expect(result.subscriptions[0].symbol).toBe('BTCUSDT');
      expect(result.subscriptions[0].subscribedAt).toBe(now);
    });

    it('should handle empty symbols array', async () => {
      const command = new SubscribeSymbolsCommand([]);
      const result = await handler.execute(command);

      expect(result.symbols).toHaveLength(0);
      expect(result.subscriptions).toHaveLength(0);
    });
  });
});