import { BinanceSpotAdapter } from '../binance-spot.adapter';
import { MarketType } from '@trade/shared';
import { LoggerPort } from '@shared';

const mockLogger: LoggerPort = {
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
};

describe('BinanceSpotAdapter (unit)', () => {
  let adapter: BinanceSpotAdapter;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    adapter = new BinanceSpotAdapter(mockLogger);
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockSpotTickerResponse = {
    symbol: 'BTCUSDT',
    priceChange: '500.00',
    priceChangePercent: '1.00',
    lastPrice: '50500.00',
    bidPrice: '50499.00',
    askPrice: '50501.00',
    openPrice: '50000.00',
    highPrice: '51000.00',
    lowPrice: '50000.00',
    volume: '10000.00',
    quoteVolume: '505000000.00',
    closeTime: Date.now(),
  };

  describe('connect', () => {
    it('should connect to Binance Spot API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await adapter.connect();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v3/ping'),
        expect.any(Object)
      );
      expect(adapter.isConnected()).toBe(true);
    });

    it('should throw error if connection fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(adapter.connect()).rejects.toThrow();
    });

    it('should return early if already connected', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await adapter.connect();
      const callCount = mockFetch.mock.calls.length;
      await adapter.connect();

      expect(mockFetch.mock.calls.length).toBe(callCount);
    });
  });

  describe('getTicker', () => {
    it('should fetch and normalize spot ticker data', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSpotTickerResponse),
        });

      const price = await adapter.getTicker('BTCUSDT');

      expect(price.symbol).toBe('BTCUSDT');
      expect(price.bid).toBe(50499);
      expect(price.ask).toBe(50501);
      expect(price.last).toBe(50500);
      expect(price.marketType).toBe(MarketType.SPOT);
      expect(price.exchange).toBe('binance');
    });

    it('should throw SymbolNotFoundError for 404 response', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        });

      await expect(adapter.getTicker('INVALID')).rejects.toThrow();
    });

    it('should use correct endpoint for 24hr ticker', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSpotTickerResponse),
        });

      await adapter.getTicker('btcusdt');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v3/ticker/24hr?symbol=BTCUSDT'),
        expect.any(Object)
      );
    });

    it('should uppercase symbol before making request', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSpotTickerResponse),
        });

      await adapter.getTicker('ethusdt');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('symbol=ETHUSDT'),
        expect.any(Object)
      );
    });
  });

  describe('getMultipleTickers', () => {
    it('should return empty array for empty input', async () => {
      const prices = await adapter.getMultipleTickers([]);
      expect(prices).toEqual([]);
    });
  });

  describe('symbolExists', () => {
    it('should return true when symbol exists', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const exists = await adapter.symbolExists('BTCUSDT');

      expect(exists).toBe(true);
    });

    it('should return false when symbol not found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const exists = await adapter.symbolExists('INVALID');

      expect(exists).toBe(false);
    });

    it('should return false on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const exists = await adapter.symbolExists('BTCUSDT');

      expect(exists).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should return exchange config with spot market type', () => {
      const config = adapter.getConfig();

      expect(config.name).toBe('binance');
      expect(config.marketType).toBe(MarketType.SPOT);
      expect(config.restUrl).toContain('api.binance.com');
      expect(config.wsUrl).toContain('stream.binance.com');
    });
  });
});