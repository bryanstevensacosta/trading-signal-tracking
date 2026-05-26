import { getExchangeConfig, BINANCE_CONFIG, BINANCE_TESTNET_CONFIG, BYBIT_CONFIG, KUCOIN_CONFIG } from '../exchange-config.vo';
import { ExchangeName } from '../exchange-config.vo';

describe('ExchangeConfig Value Objects', () => {
  describe('getExchangeConfig', () => {
    it('should return binance config by default', () => {
      const config = getExchangeConfig('binance');
      expect(config.name).toBe('binance');
      expect(config.restUrl).toBe('https://api.binance.com');
      expect(config.wsUrl).toBe('wss://stream.binance.com:9443');
      expect(config.testnet).toBe(false);
    });

    it('should return binance testnet config when testnet is true', () => {
      const config = getExchangeConfig('binance', true);
      expect(config.name).toBe('binance');
      expect(config.restUrl).toBe('https://testnet.binance.vision');
      expect(config.wsUrl).toBe('wss://testnet.binance.vision');
      expect(config.testnet).toBe(true);
    });

    it('should return bybit config', () => {
      const config = getExchangeConfig('bybit');
      expect(config.name).toBe('bybit');
      expect(config.restUrl).toBe('https://api.bybit.com');
      expect(config.wsUrl).toBe('wss://stream.bybit.com/v5/public/spot');
      expect(config.testnet).toBe(false);
    });

    it('should return kucoin config', () => {
      const config = getExchangeConfig('kucoin');
      expect(config.name).toBe('kucoin');
      expect(config.restUrl).toBe('https://api.kucoin.com');
      expect(config.wsUrl).toBe('wss://ws-api-spot.kucoin.com');
      expect(config.testnet).toBe(false);
    });

    it('should throw error for unsupported exchange', () => {
      expect(() => getExchangeConfig('unsupported' as ExchangeName)).toThrow('Unsupported exchange: unsupported');
    });
  });

  describe('BINANCE_CONFIG', () => {
    it('should have correct production values', () => {
      expect(BINANCE_CONFIG.name).toBe('binance');
      expect(BINANCE_CONFIG.restUrl).toBe('https://api.binance.com');
      expect(BINANCE_CONFIG.wsUrl).toBe('wss://stream.binance.com:9443');
      expect(BINANCE_CONFIG.testnet).toBe(false);
    });
  });

  describe('BINANCE_TESTNET_CONFIG', () => {
    it('should have correct testnet values', () => {
      expect(BINANCE_TESTNET_CONFIG.name).toBe('binance');
      expect(BINANCE_TESTNET_CONFIG.restUrl).toBe('https://testnet.binance.vision');
      expect(BINANCE_TESTNET_CONFIG.wsUrl).toBe('wss://testnet.binance.vision');
      expect(BINANCE_TESTNET_CONFIG.testnet).toBe(true);
    });
  });

  describe('BYBIT_CONFIG', () => {
    it('should have correct values', () => {
      expect(BYBIT_CONFIG.name).toBe('bybit');
      expect(BYBIT_CONFIG.restUrl).toBe('https://api.bybit.com');
      expect(BYBIT_CONFIG.wsUrl).toBe('wss://stream.bybit.com/v5/public/spot');
      expect(BYBIT_CONFIG.testnet).toBe(false);
    });
  });

  describe('KUCOIN_CONFIG', () => {
    it('should have correct values', () => {
      expect(KUCOIN_CONFIG.name).toBe('kucoin');
      expect(KUCOIN_CONFIG.restUrl).toBe('https://api.kucoin.com');
      expect(KUCOIN_CONFIG.wsUrl).toBe('wss://ws-api-spot.kucoin.com');
      expect(KUCOIN_CONFIG.testnet).toBe(false);
    });
  });
});