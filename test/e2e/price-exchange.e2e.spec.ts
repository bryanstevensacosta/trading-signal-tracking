import { Test, TestingModule } from '@nestjs/testing';
import { BinanceProviderModule } from '../../src/price/provider/binance/binance.module';
import { BinanceSpotAdapter } from '../../src/price/provider/binance/infrastructure/adapters/binance-spot.adapter';
import { BinanceFuturesAdapter } from '../../src/price/provider/binance/infrastructure/adapters/binance-futures.adapter';
import { MarketType } from '../../src/trade/shared';

describe('PriceExchangeModule (e2e) - Spot & Futures', () => {
  let module: TestingModule;
  let spotAdapter: BinanceSpotAdapter;
  let futuresAdapter: BinanceFuturesAdapter;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [BinanceProviderModule],
    }).compile();

    spotAdapter = module.get<BinanceSpotAdapter>(BinanceSpotAdapter);
    futuresAdapter = module.get<BinanceFuturesAdapter>(BinanceFuturesAdapter);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Module Integration', () => {
    it('should create the module', () => {
      expect(module).toBeDefined();
    });

    it('should provide BinanceSpotAdapter', () => {
      expect(spotAdapter).toBeDefined();
      expect(spotAdapter).toBeInstanceOf(BinanceSpotAdapter);
    });

    it('should provide BinanceFuturesAdapter', () => {
      expect(futuresAdapter).toBeDefined();
      expect(futuresAdapter).toBeInstanceOf(BinanceFuturesAdapter);
    });

    it('should have spot adapter with correct config', () => {
      const config = spotAdapter.getConfig();
      expect(config.name).toBe('binance');
      expect(config.marketType).toBe(MarketType.SPOT);
      expect(config.restUrl).toContain('api.binance.com');
      expect(config.wsUrl).toContain('stream.binance.com');
    });

    it('should have futures adapter with correct config', () => {
      const config = futuresAdapter.getConfig();
      expect(config.name).toBe('binance');
      expect(config.marketType).toBe(MarketType.FUTURES);
      expect(config.restUrl).toContain('fapi.binance.com');
      expect(config.wsUrl).toContain('fstream.binance.com');
    });
  });

  describe('Spot Adapter Methods', () => {
    it('should have all BinanceSpotPort methods', () => {
      expect(typeof spotAdapter.connect).toBe('function');
      expect(typeof spotAdapter.disconnect).toBe('function');
      expect(typeof spotAdapter.isConnected).toBe('function');
      expect(typeof spotAdapter.getTicker).toBe('function');
      expect(typeof spotAdapter.getMultipleTickers).toBe('function');
      expect(typeof spotAdapter.subscribeToTicker).toBe('function');
      expect(typeof spotAdapter.subscribeToMultipleTickers).toBe('function');
      expect(typeof spotAdapter.symbolExists).toBe('function');
      expect(typeof spotAdapter.getConfig).toBe('function');
    });
  });

  describe('Futures Adapter Methods', () => {
    it('should have all BinanceFuturesPort methods', () => {
      expect(typeof futuresAdapter.connect).toBe('function');
      expect(typeof futuresAdapter.disconnect).toBe('function');
      expect(typeof futuresAdapter.isConnected).toBe('function');
      expect(typeof futuresAdapter.getTicker).toBe('function');
      expect(typeof futuresAdapter.getMultipleTickers).toBe('function');
      expect(typeof futuresAdapter.getMarkPrice).toBe('function');
      expect(typeof futuresAdapter.subscribeToTicker).toBe('function');
      expect(typeof futuresAdapter.subscribeToMarkPrice).toBe('function');
      expect(typeof futuresAdapter.subscribeToMultipleTickers).toBe('function');
      expect(typeof futuresAdapter.symbolExists).toBe('function');
      expect(typeof futuresAdapter.getConfig).toBe('function');
    });
  });

  describe('Spot and Futures - Market Type Differentiation', () => {
    it('should use different REST endpoints for spot vs futures', () => {
      const spotConfig = spotAdapter.getConfig();
      const futuresConfig = futuresAdapter.getConfig();

      expect(spotConfig.restUrl).not.toBe(futuresConfig.restUrl);
      expect(spotConfig.restUrl).toContain('api.binance.com');
      expect(futuresConfig.restUrl).toContain('fapi.binance.com');
    });

    it('should use different WebSocket endpoints for spot vs futures', () => {
      const spotConfig = spotAdapter.getConfig();
      const futuresConfig = futuresAdapter.getConfig();

      expect(spotConfig.wsUrl).not.toBe(futuresConfig.wsUrl);
      expect(spotConfig.wsUrl).toContain('stream.binance.com');
      expect(futuresConfig.wsUrl).toContain('fstream.binance.com');
    });

    it('should have market type correctly set', () => {
      const spotConfig = spotAdapter.getConfig();
      const futuresConfig = futuresAdapter.getConfig();

      expect(spotConfig.marketType).toBe(MarketType.SPOT);
      expect(futuresConfig.marketType).toBe(MarketType.FUTURES);
    });
  });
});