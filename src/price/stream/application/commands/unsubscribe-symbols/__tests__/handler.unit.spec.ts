import { UnsubscribeSymbolsHandler } from '../handler';
import { UnsubscribeSymbolsCommand } from '../command';
import { PriceStreamService } from '../../../../domain/services/price-stream.service';
import { PriceStreamPort } from '../../../../domain/ports/price-stream.port';

describe('UnsubscribeSymbolsHandler', () => {
  const mockUnsubscribe = jest.fn();
  const mockIsSubscribed = jest.fn();
  const mockPriceStream: PriceStreamPort = {
    subscribe: jest.fn(),
    unsubscribe: mockUnsubscribe,
    unsubscribeAll: jest.fn(),
    getActiveSubscriptions: jest.fn(),
    isSubscribed: mockIsSubscribed,
  } as unknown as PriceStreamPort;

  const handler = new UnsubscribeSymbolsHandler(mockPriceStream as unknown as PriceStreamService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should unsubscribe from subscribed symbols', async () => {
      mockIsSubscribed.mockReturnValue(true);

      const command = new UnsubscribeSymbolsCommand(['BTCUSDT']);
      const result = await handler.execute(command);

      expect(result.unsubscribed).toContain('BTCUSDT');
      expect(mockUnsubscribe).toHaveBeenCalledWith('BTCUSDT');
    });

    it('should not unsubscribe from non-subscribed symbols', async () => {
      mockIsSubscribed.mockReturnValue(false);

      const command = new UnsubscribeSymbolsCommand(['NONEXISTENT']);
      const result = await handler.execute(command);

      expect(result.unsubscribed).not.toContain('NONEXISTENT');
      expect(mockUnsubscribe).not.toHaveBeenCalled();
    });

    it('should return both subscribed and non-subscribed symbols', async () => {
      mockIsSubscribed.mockImplementation((s: string) => s === 'BTCUSDT');

      const command = new UnsubscribeSymbolsCommand(['BTCUSDT', 'NONEXISTENT']);
      const result = await handler.execute(command);

      expect(result.symbols).toContain('BTCUSDT');
      expect(result.symbols).toContain('NONEXISTENT');
      expect(result.unsubscribed).toContain('BTCUSDT');
      expect(result.unsubscribed).not.toContain('NONEXISTENT');
    });

    it('should normalize symbols to uppercase', async () => {
      mockIsSubscribed.mockReturnValue(true);

      const command = new UnsubscribeSymbolsCommand(['btcusdt']);
      await handler.execute(command);

      expect(mockIsSubscribed).toHaveBeenCalledWith('BTCUSDT');
    });
  });
});