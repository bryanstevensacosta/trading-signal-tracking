import { Test, TestingModule } from '@nestjs/testing';
import { PriceCacheService } from '../price-cache.service';
import { Price } from '@trade/shared';

describe('PriceCacheService', () => {
  let service: PriceCacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PriceCacheService],
    }).compile();

    service = module.get<PriceCacheService>(PriceCacheService);
  });

  beforeEach(() => {
    service.clear();
  });

  describe('set', () => {
    it('should store price with uppercase symbol', () => {
      const price: Price = {
        symbol: 'btcusdt',
        bid: 50000,
        ask: 50001,
        last: 50000.5,
        timestamp: new Date(),
      };

      service.set(price);

      expect(service.has('BTCUSDT')).toBe(true);
      expect(service.has('btcusdt')).toBe(true);
    });

    it('should update existing price', () => {
      const price1: Price = {
        symbol: 'BTCUSDT',
        bid: 50000,
        ask: 50001,
        last: 50000,
        timestamp: new Date(),
      };

      const price2: Price = {
        symbol: 'BTCUSDT',
        bid: 51000,
        ask: 51001,
        last: 51000,
        timestamp: new Date(),
      };

      service.set(price1);
      service.set(price2);

      const cached = service.get('BTCUSDT');
      expect(cached?.last).toBe(51000);
    });

    it('should set timestamp on cache', () => {
      const beforeSet = new Date();
      const price: Price = {
        symbol: 'BTCUSDT',
        bid: 50000,
        ask: 50001,
        last: 50000,
        timestamp: new Date(1000),
      };

      service.set(price);

      const cached = service.get('BTCUSDT');
      expect(cached?.timestamp.getTime()).toBeGreaterThanOrEqual(beforeSet.getTime());
    });
  });

  describe('get', () => {
    it('should return cached price', () => {
      const price: Price = {
        symbol: 'BTCUSDT',
        bid: 50000,
        ask: 50001,
        last: 50000,
        timestamp: new Date(),
      };

      service.set(price);

      const cached = service.get('BTCUSDT');
      expect(cached).toBeDefined();
      expect(cached?.symbol).toBe('BTCUSDT');
      expect(cached?.last).toBe(50000);
    });

    it('should return null for non-existent symbol', () => {
      const cached = service.get('NONEXISTENT');
      expect(cached).toBeNull();
    });

    it('should be case insensitive', () => {
      const price: Price = {
        symbol: 'BTCUSDT',
        bid: 50000,
        ask: 50001,
        last: 50000,
        timestamp: new Date(),
      };

      service.set(price);

      expect(service.get('btcusdt')?.symbol).toBe('BTCUSDT');
      expect(service.get('BtcUsdt')?.symbol).toBe('BTCUSDT');
    });
  });

  describe('getAll', () => {
    it('should return all cached prices', () => {
      service.set({ symbol: 'BTCUSDT', bid: 50000, ask: 50001, last: 50000, timestamp: new Date() });
      service.set({ symbol: 'ETHUSDT', bid: 3000, ask: 3001, last: 3000, timestamp: new Date() });

      const all = service.getAll();

      expect(all).toHaveLength(2);
      expect(all.map((p: Price) => p.symbol)).toContain('BTCUSDT');
      expect(all.map((p: Price) => p.symbol)).toContain('ETHUSDT');
    });

    it('should return empty array when cache is empty', () => {
      const all = service.getAll();
      expect(all).toEqual([]);
    });
  });

  describe('remove', () => {
    it('should remove price from cache', () => {
      const price: Price = {
        symbol: 'BTCUSDT',
        bid: 50000,
        ask: 50001,
        last: 50000,
        timestamp: new Date(),
      };

      service.set(price);
      service.remove('BTCUSDT');

      expect(service.has('BTCUSDT')).toBe(false);
      expect(service.get('BTCUSDT')).toBeNull();
    });

    it('should be case insensitive', () => {
      const price: Price = {
        symbol: 'BTCUSDT',
        bid: 50000,
        ask: 50001,
        last: 50000,
        timestamp: new Date(),
      };

      service.set(price);
      service.remove('btcusdt');

      expect(service.has('BTCUSDT')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all prices from cache', () => {
      service.set({ symbol: 'BTCUSDT', bid: 50000, ask: 50001, last: 50000, timestamp: new Date() });
      service.set({ symbol: 'ETHUSDT', bid: 3000, ask: 3001, last: 3000, timestamp: new Date() });

      service.clear();

      expect(service.size()).toBe(0);
      expect(service.getAll()).toEqual([]);
    });
  });

  describe('has', () => {
    it('should return true for cached symbol', () => {
      const price: Price = {
        symbol: 'BTCUSDT',
        bid: 50000,
        ask: 50001,
        last: 50000,
        timestamp: new Date(),
      };

      service.set(price);

      expect(service.has('BTCUSDT')).toBe(true);
    });

    it('should return false for non-cached symbol', () => {
      expect(service.has('NONEXISTENT')).toBe(false);
    });

    it('should be case insensitive', () => {
      const price: Price = {
        symbol: 'BTCUSDT',
        bid: 50000,
        ask: 50001,
        last: 50000,
        timestamp: new Date(),
      };

      service.set(price);

      expect(service.has('btcusdt')).toBe(true);
    });
  });

  describe('size', () => {
    it('should return correct cache size', () => {
      expect(service.size()).toBe(0);

      service.set({ symbol: 'BTCUSDT', bid: 50000, ask: 50001, last: 50000, timestamp: new Date() });
      expect(service.size()).toBe(1);

      service.set({ symbol: 'ETHUSDT', bid: 3000, ask: 3001, last: 3000, timestamp: new Date() });
      expect(service.size()).toBe(2);

      service.remove('BTCUSDT');
      expect(service.size()).toBe(1);
    });
  });

  describe('getBySymbols', () => {
    it('should return prices for multiple symbols', () => {
      service.set({ symbol: 'BTCUSDT', bid: 50000, ask: 50001, last: 50000, timestamp: new Date() });
      service.set({ symbol: 'ETHUSDT', bid: 3000, ask: 3001, last: 3000, timestamp: new Date() });

      const prices = service.getBySymbols(['BTCUSDT', 'ETHUSDT']);

      expect(prices).toHaveLength(2);
      expect(prices.map((p: Price) => p.symbol)).toContain('BTCUSDT');
      expect(prices.map((p: Price) => p.symbol)).toContain('ETHUSDT');
    });

    it('should filter out non-cached symbols', () => {
      service.set({ symbol: 'BTCUSDT', bid: 50000, ask: 50001, last: 50000, timestamp: new Date() });

      const prices = service.getBySymbols(['BTCUSDT', 'NONEXISTENT']);

      expect(prices).toHaveLength(1);
      expect(prices[0].symbol).toBe('BTCUSDT');
    });

    it('should return empty array when no symbols are cached', () => {
      const prices = service.getBySymbols(['BTCUSDT', 'ETHUSDT']);
      expect(prices).toEqual([]);
    });

    it('should be case insensitive', () => {
      service.set({ symbol: 'BTCUSDT', bid: 50000, ask: 50001, last: 50000, timestamp: new Date() });

      const prices = service.getBySymbols(['btcusdt']);

      expect(prices).toHaveLength(1);
    });
  });
});