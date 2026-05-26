import { Test, TestingModule } from '@nestjs/testing';
import { PriceCacheService } from '../../domain/services/price-cache.service';
import { SetPriceHandler } from '../commands/set-price/handler';
import { SetPriceCommand } from '../commands/set-price/command';
import { RemovePriceHandler } from '../commands/remove-price/handler';
import { RemovePriceCommand } from '../commands/remove-price/command';
import { GetPriceHandler } from '../queries/get-price/handler';
import { GetPriceQuery } from '../queries/get-price/query';
import { GetAllPricesHandler } from '../queries/get-all-prices/handler';
import { GetAllPricesQuery } from '../queries/get-all-prices/query';
import { Price } from '@trade/shared';

describe('PriceCache Handlers', () => {
  let service: PriceCacheService;
  let setPriceHandler: SetPriceHandler;
  let removePriceHandler: RemovePriceHandler;
  let getPriceHandler: GetPriceHandler;
  let getAllPricesHandler: GetAllPricesHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceCacheService,
        SetPriceHandler,
        RemovePriceHandler,
        GetPriceHandler,
        GetAllPricesHandler,
      ],
    }).compile();

    service = module.get<PriceCacheService>(PriceCacheService);
    setPriceHandler = module.get<SetPriceHandler>(SetPriceHandler);
    removePriceHandler = module.get<RemovePriceHandler>(RemovePriceHandler);
    getPriceHandler = module.get<GetPriceHandler>(GetPriceHandler);
    getAllPricesHandler = module.get<GetAllPricesHandler>(GetAllPricesHandler);
  });

  beforeEach(() => {
    service.clear();
  });

  describe('SetPriceHandler', () => {
    it('should set price in cache', async () => {
      const price: Price = {
        symbol: 'BTCUSDT',
        bid: 50000,
        ask: 50001,
        last: 50000,
        timestamp: new Date(),
      };

      await setPriceHandler.execute(new SetPriceCommand(price));

      expect(service.has('BTCUSDT')).toBe(true);
      expect(service.get('BTCUSDT')?.last).toBe(50000);
    });
  });

  describe('RemovePriceHandler', () => {
    it('should remove price from cache', async () => {
      const price: Price = {
        symbol: 'BTCUSDT',
        bid: 50000,
        ask: 50001,
        last: 50000,
        timestamp: new Date(),
      };

      service.set(price);
      await removePriceHandler.execute(new RemovePriceCommand('BTCUSDT'));

      expect(service.has('BTCUSDT')).toBe(false);
    });
  });

  describe('GetPriceHandler', () => {
    it('should return cached price', async () => {
      const price: Price = {
        symbol: 'BTCUSDT',
        bid: 50000,
        ask: 50001,
        last: 50000,
        timestamp: new Date(),
      };

      service.set(price);

      const result = await getPriceHandler.execute(new GetPriceQuery('BTCUSDT'));

      expect(result).toBeDefined();
      expect(result?.symbol).toBe('BTCUSDT');
    });

    it('should return null for non-existent symbol', async () => {
      const result = await getPriceHandler.execute(new GetPriceQuery('NONEXISTENT'));

      expect(result).toBeNull();
    });
  });

  describe('GetAllPricesHandler', () => {
    it('should return all cached prices', async () => {
      service.set({ symbol: 'BTCUSDT', bid: 50000, ask: 50001, last: 50000, timestamp: new Date() });
      service.set({ symbol: 'ETHUSDT', bid: 3000, ask: 3001, last: 3000, timestamp: new Date() });

      const result = await getAllPricesHandler.execute(new GetAllPricesQuery());

      expect(result).toHaveLength(2);
    });

    it('should return empty array when cache is empty', async () => {
      const result = await getAllPricesHandler.execute(new GetAllPricesQuery());

      expect(result).toEqual([]);
    });
  });
});