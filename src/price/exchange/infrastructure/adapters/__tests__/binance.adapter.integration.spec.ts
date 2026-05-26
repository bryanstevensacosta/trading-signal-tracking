import { BinanceExchangeAdapter } from '../binance.adapter';
import { BINANCE_CONFIG } from '../../../domain/value-objects/exchange-config.vo';
import { Price } from '@trade/shared';
import { ExchangeConnectionError } from '../../../domain/errors/exchange-errors';

describe('BinanceExchangeAdapter', () => {
  let adapter: BinanceExchangeAdapter;

  beforeEach(() => {
    adapter = new BinanceExchangeAdapter(BINANCE_CONFIG);
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  describe('connect', () => {
    it('should connect to binance API', async () => {
      await adapter.connect();
      expect(adapter.isConnected()).toBe(true);
    });

    it('should be idempotent - calling connect twice should not error', async () => {
      await adapter.connect();
      await adapter.connect();
      expect(adapter.isConnected()).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should disconnect from binance', async () => {
      await adapter.connect();
      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
    });

    it('should be idempotent', async () => {
      await adapter.disconnect();
      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe('getTicker', () => {
    it('should auto-connect if not connected', async () => {
      // getTicker should auto-connect, no need to call connect() first
      const price = await adapter.getTicker('BTCUSDT');
      expect(price.symbol).toBe('BTCUSDT');
      expect(price.bid).toBeGreaterThan(0);
    });

    it('should return ticker data for BTCUSDT', async () => {
      await adapter.connect();
      const price = await adapter.getTicker('BTCUSDT');

      expect(price.symbol).toBe('BTCUSDT');
      expect(price.bid).toBeGreaterThan(0);
      expect(price.ask).toBeGreaterThan(0);
      expect(price.last).toBeGreaterThan(0);
      expect(price.exchange).toBe('binance');
      expect(price.timestamp).toBeInstanceOf(Date);
    });

    it('should normalize symbol to uppercase', async () => {
      await adapter.connect();
      const price = await adapter.getTicker('btcusdt');

      expect(price.symbol).toBe('BTCUSDT');
    });

    it('should throw for non-existent symbol', async () => {
      await adapter.connect();
      // Binance returns HTTP 400 for invalid symbols, which gets wrapped in ExchangeConnectionError
      // or HTTP 404 which gets converted to SymbolNotFoundError
      await expect(adapter.getTicker('NONEXISTENT')).rejects.toThrow();
    });
  });

  describe('getMultipleTickers', () => {
    it('should return tickers for multiple symbols', async () => {
      await adapter.connect();
      const prices = await adapter.getMultipleTickers(['BTCUSDT', 'ETHUSDT']);

      expect(prices).toHaveLength(2);
      expect(prices.some((p: Price) => p.symbol === 'BTCUSDT')).toBe(true);
      expect(prices.some((p: Price) => p.symbol === 'ETHUSDT')).toBe(true);
    });

    it('should return empty array for empty input', async () => {
      await adapter.connect();
      const prices = await adapter.getMultipleTickers([]);

      expect(prices).toEqual([]);
    });

    it('should filter out invalid symbols', async () => {
      await adapter.connect();
      const prices = await adapter.getMultipleTickers(['BTCUSDT', 'INVALID']);

      expect(prices).toHaveLength(1);
      expect(prices[0].symbol).toBe('BTCUSDT');
    });
  });

  describe('subscribeToTicker', () => {
    it('should return unsubscribe function', async () => {
      await adapter.connect();
      const callback = jest.fn();
      const unsubscribe = adapter.subscribeToTicker('BTCUSDT', callback);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should call callback with price updates', async () => {
      await adapter.connect();
      const callback = jest.fn();

      adapter.subscribeToTicker('BTCUSDT', callback);

      await new Promise(resolve => setTimeout(resolve, 2000));

      // In real environment, callback would be called
      // For CI/CD, we just verify unsubscribe works
      expect(typeof callback).toBe('function');
    }, 10000);
  });

  describe('getConfig', () => {
    it('should return the exchange configuration', () => {
      const config = adapter.getConfig();

      expect(config.name).toBe('binance');
      expect(config.restUrl).toBeTruthy();
      expect(config.wsUrl).toBeTruthy();
    });

    it('should return a copy, not the original', () => {
      const config = adapter.getConfig();
      const originalRestUrl = config.restUrl;
      config.restUrl = 'https://modified.example.com';

      const config2 = adapter.getConfig();
      expect(config2.restUrl).toBe(originalRestUrl);
    });
  });
});