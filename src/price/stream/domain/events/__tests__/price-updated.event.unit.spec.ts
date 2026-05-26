import { PriceUpdatedEvent } from '../price-updated.event';
import { Price } from '@trade/shared';

describe('PriceUpdatedEvent', () => {
  describe('constructor', () => {
    it('should create event with price', () => {
      const mockPrice: Price = {
        symbol: 'BTCUSDT',
        bid: 50000,
        ask: 50001,
        last: 50000.5,
        timestamp: new Date(),
        exchange: 'binance',
      };

      const event = new PriceUpdatedEvent(mockPrice);

      expect(event.price).toBe(mockPrice);
    });
  });

  describe('immutability', () => {
    it('should not allow modifying price after creation', () => {
      const mockPrice: Price = {
        symbol: 'BTCUSDT',
        bid: 50000,
        ask: 50001,
        last: 50000.5,
        timestamp: new Date(),
        exchange: 'binance',
      };

      const event = new PriceUpdatedEvent(mockPrice);
      const newPrice: Price = { ...mockPrice, symbol: 'ETHUSDT' };

      expect(event.price.symbol).toBe('BTCUSDT');
      expect(newPrice.symbol).toBe('ETHUSDT');
    });
  });
});