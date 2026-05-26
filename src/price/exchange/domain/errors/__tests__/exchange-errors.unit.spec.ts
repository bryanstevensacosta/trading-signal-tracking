import {
  ExchangeConnectionError,
  SymbolNotFoundError,
  SubscriptionError,
  ExchangeTimeoutError,
} from '../exchange-errors';

describe('Exchange Errors', () => {
  describe('ExchangeConnectionError', () => {
    it('should format message correctly', () => {
      const error = new ExchangeConnectionError('binance', 'Connection refused');
      expect(error.message).toBe('Failed to connect to binance: Connection refused');
      expect(error.name).toBe('ExchangeConnectionError');
    });

    it('should be instanceof Error', () => {
      const error = new ExchangeConnectionError('bybit', 'Timeout');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('SymbolNotFoundError', () => {
    it('should format message correctly', () => {
      const error = new SymbolNotFoundError('BTCUSDT', 'binance');
      expect(error.message).toBe('Symbol BTCUSDT not found on binance');
      expect(error.name).toBe('SymbolNotFoundError');
    });

    it('should be instanceof Error', () => {
      const error = new SymbolNotFoundError('ETHUSDT', 'bybit');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('SubscriptionError', () => {
    it('should format message correctly', () => {
      const error = new SubscriptionError('BTCUSDT', 'Already subscribed');
      expect(error.message).toBe('Failed to subscribe to BTCUSDT: Already subscribed');
      expect(error.name).toBe('SubscriptionError');
    });

    it('should be instanceof Error', () => {
      const error = new SubscriptionError('SOLUSDT', 'Error');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('ExchangeTimeoutError', () => {
    it('should format message correctly', () => {
      const error = new ExchangeTimeoutError('binance', 'getTicker', 10000);
      expect(error.message).toBe('Exchange binance operation getTicker timed out after 10000ms');
      expect(error.name).toBe('ExchangeTimeoutError');
    });

    it('should include timeout value', () => {
      const error = new ExchangeTimeoutError('kucoin', 'connect', 5000);
      expect(error.message).toContain('5000ms');
    });

    it('should be instanceof Error', () => {
      const error = new ExchangeTimeoutError('bybit', 'subscribe', 3000);
      expect(error).toBeInstanceOf(Error);
    });
  });
});