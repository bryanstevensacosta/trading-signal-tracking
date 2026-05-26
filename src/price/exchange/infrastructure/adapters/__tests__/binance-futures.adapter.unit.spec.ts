import { BinanceFuturesAdapter } from '../binance-futures.adapter';
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

describe('BinanceFuturesAdapter (unit)', () => {
  let adapter: BinanceFuturesAdapter;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    adapter = new BinanceFuturesAdapter(mockLogger);
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockFuturesTickerResponse = {
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

  const mockMarkPriceResponse = {
    symbol: 'BTCUSDT',
    markPrice: '50500.50',
    indexPrice: '50499.00',
    estimatedSettlePrice: '50500.00',
    lastFundingRate: '0.0001',
    nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
  };

  const mockFundingRateResponse = {
    symbol: 'BTCUSDT',
    fundingRate: '0.0001',
    fundingTime: Date.now(),
  };

  describe('connect', () => {
    it('should connect to Binance Futures API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await adapter.connect();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/fapi/v1/ping'),
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
    it('should fetch and normalize futures ticker data', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFuturesTickerResponse),
        });

      const price = await adapter.getTicker('BTCUSDT');

      expect(price.symbol).toBe('BTCUSDT');
      expect(price.bid).toBe(50499);
      expect(price.ask).toBe(50501);
      expect(price.last).toBe(50500);
      expect(price.marketType).toBe(MarketType.FUTURES);
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

    it('should use correct endpoint for futures 24hr ticker', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFuturesTickerResponse),
        });

      await adapter.getTicker('BTCUSDT');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/fapi/v1/ticker/24hr?symbol=BTCUSDT'),
        expect.any(Object)
      );
    });
  });

  describe('getMarkPrice', () => {
    it('should fetch mark price and funding rate', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMarkPriceResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFundingRateResponse),
        });

      const result = await adapter.getMarkPrice('BTCUSDT');

      expect(result.markPrice).toBe(50500.5);
      expect(result.indexPrice).toBe(50499);
      expect(result.fundingRate).toBe(0.0001);
    });

    it('should handle funding rate fetch failure', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMarkPriceResponse),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

      const result = await adapter.getMarkPrice('BTCUSDT');

      expect(result.markPrice).toBe(50500.5);
      expect(result.fundingRate).toBe(0);
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

    it('should use futures exchangeInfo endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await adapter.symbolExists('BTCUSDT');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/fapi/v1/exchangeInfo?symbol=BTCUSDT'),
        expect.any(Object)
      );
    });
  });

  describe('getConfig', () => {
    it('should return exchange config with futures market type', () => {
      const config = adapter.getConfig();

      expect(config.name).toBe('binance');
      expect(config.marketType).toBe(MarketType.FUTURES);
      expect(config.restUrl).toContain('fapi.binance.com');
      expect(config.wsUrl).toContain('fstream.binance.com');
    });
  });
});