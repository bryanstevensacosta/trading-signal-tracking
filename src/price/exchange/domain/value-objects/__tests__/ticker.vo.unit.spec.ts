import { createTicker } from '../ticker.vo';

describe('Ticker Value Object', () => {
  describe('createTicker', () => {
    it('should create ticker from raw data', () => {
      const data = {
        bidPrice: '50000.00',
        askPrice: '50001.00',
        lastPrice: '50000.50',
        volume: '12345.67',
        closeTime: 1700000000000,
      };

      const ticker = createTicker(data, 'BTCUSDT');

      expect(ticker.symbol).toBe('BTCUSDT');
      expect(ticker.bid).toBe(50000);
      expect(ticker.ask).toBe(50001);
      expect(ticker.last).toBe(50000.5);
      expect(ticker.volume24h).toBe(12345.67);
      expect(ticker.timestamp).toEqual(new Date(1700000000000));
    });

    it('should uppercase symbol', () => {
      const data = {
        bidPrice: '100',
        askPrice: '101',
        lastPrice: '100.5',
        volume: '0',
        closeTime: 0,
      };

      const ticker = createTicker(data, 'ethusdt');

      expect(ticker.symbol).toBe('ETHUSDT');
    });

    it('should handle missing values with defaults', () => {
      const data = {};

      const ticker = createTicker(data, 'BTCUSDT');

      expect(ticker.symbol).toBe('BTCUSDT');
      expect(ticker.bid).toBe(0);
      expect(ticker.ask).toBe(0);
      expect(ticker.last).toBe(0);
      expect(ticker.volume24h).toBe(0);
      expect(ticker.timestamp).toBeInstanceOf(Date);
    });

    it('should use current time when closeTime is missing', () => {
      const before = Date.now();
      const data = {};
      const ticker = createTicker(data, 'BTCUSDT');
      const after = Date.now();

      expect(ticker.timestamp.getTime()).toBeGreaterThanOrEqual(before);
      expect(ticker.timestamp.getTime()).toBeLessThanOrEqual(after);
    });
  });
});