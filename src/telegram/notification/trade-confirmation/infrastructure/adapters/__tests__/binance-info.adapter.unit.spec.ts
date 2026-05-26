import { BinanceInfoAdapter } from '../binance-info.adapter';
import { BinanceInfo } from '../../../domain/ports/binance-info.port';
import { LoggerPort } from '@shared';

const mockLogger: LoggerPort = {
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
};

describe('BinanceInfoAdapter (unit)', () => {
  let adapter: BinanceInfoAdapter;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    adapter = new BinanceInfoAdapter(mockLogger);
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockBinanceResponse = {
    symbol: 'BTCUSDT',
    priceChange: '500.00',
    priceChangePercent: '1.50',
    lastPrice: '50000.00',
    highPrice: '51000.00',
    lowPrice: '49000.00',
    volume: '1000000',
    quoteVolume: '1500000000',
  };

  describe('getTickerInfo', () => {
    it('should fetch and parse Binance ticker data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockBinanceResponse),
      });

      const result = await adapter.getTickerInfo('BTCUSDT', true);

      expect(result).toEqual<BinanceInfo>({
        symbol: 'BTCUSDT',
        price: 50000,
        change24hPercent: 1.5,
        volume24h: 1500000000,
        high24h: 51000,
        low24h: 49000,
      });
    });

    it('should strip USDT suffix and re-add it', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockBinanceResponse),
      });

      await adapter.getTickerInfo('btcusdt', true);

      expect(mockFetch).toHaveBeenCalled();
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toContain('BTCUSDT');
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
      });

      const result = await adapter.getTickerInfo('BTCUSDT', true);

      expect(result.price).toBe(0);
      expect(result.change24hPercent).toBe(0);
      expect(result.volume24h).toBe(0);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await adapter.getTickerInfo('BTCUSDT', true);

      expect(result.price).toBe(0);
      expect(result.symbol).toBe('BTCUSDT');
    });

    it('should handle timeout via AbortController', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      const result = await adapter.getTickerInfo('BTCUSDT', true);

      expect(result.price).toBe(0);
    });

    it('should handle malformed JSON', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const result = await adapter.getTickerInfo('BTCUSDT', true);

      expect(result.price).toBe(0);
    });

    it('should handle missing fields in response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ symbol: 'ETHUSDT' }),
      });

      const result = await adapter.getTickerInfo('ETHUSDT', true);

      expect(Number.isNaN(result.price)).toBe(true);
      expect(Number.isNaN(result.change24hPercent)).toBe(true);
    });

    it('should use futures URL for isFutures=true', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockBinanceResponse),
      });

      await adapter.getTickerInfo('BTCUSDT', true);

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toContain('fapi.binance.com');
    });

    it('should use spot URL for isFutures=false', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockBinanceResponse),
      });

      await adapter.getTickerInfo('BTCUSDT', false);

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toContain('api.binance.com');
    });
  });
});