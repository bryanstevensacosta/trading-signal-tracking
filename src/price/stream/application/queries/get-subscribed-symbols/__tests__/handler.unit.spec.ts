import { GetSubscribedSymbolsHandler, GetSubscribedSymbolsQuery } from '../query';
import { PriceStreamService } from '../../../../domain/services/price-stream.service';
import { PriceStreamPort } from '../../../../domain/ports/price-stream.port';

describe('GetSubscribedSymbolsHandler', () => {
  const mockGetActiveSubscriptions = jest.fn();
  const mockPriceStream: PriceStreamPort = {
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    unsubscribeAll: jest.fn(),
    getActiveSubscriptions: mockGetActiveSubscriptions,
    isSubscribed: jest.fn(),
  } as unknown as PriceStreamPort;

  const handler = new GetSubscribedSymbolsHandler(mockPriceStream as unknown as PriceStreamService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return subscribed symbols', async () => {
      mockGetActiveSubscriptions.mockReturnValue(['BTCUSDT', 'ETHUSDT']);

      const query = new GetSubscribedSymbolsQuery();
      const result = await handler.execute(query);

      expect(result.symbols).toEqual(['BTCUSDT', 'ETHUSDT']);
    });

    it('should return empty array when no subscriptions', async () => {
      mockGetActiveSubscriptions.mockReturnValue([]);

      const query = new GetSubscribedSymbolsQuery();
      const result = await handler.execute(query);

      expect(result.symbols).toEqual([]);
    });
  });
});