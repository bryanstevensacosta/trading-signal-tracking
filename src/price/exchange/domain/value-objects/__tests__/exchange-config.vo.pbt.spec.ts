import fc from 'fast-check';
import { getExchangeConfig, BINANCE_CONFIG, BINANCE_TESTNET_CONFIG, BYBIT_CONFIG, KUCOIN_CONFIG } from '../exchange-config.vo';
import { ExchangeName } from '../exchange-config.vo';

describe('ExchangeConfig (property-based)', () => {
  it('should always return valid config for binance', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (testnet) => {
          const config = getExchangeConfig('binance', testnet);
          expect(config.name).toBe('binance');
          expect(config.testnet).toBe(testnet);
          expect(config.restUrl).toBeTruthy();
          expect(config.wsUrl).toBeTruthy();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('should always return valid config for bybit', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (testnet) => {
          const config = getExchangeConfig('bybit', testnet);
          expect(config.name).toBe('bybit');
          expect(config.testnet).toBe(false); // testnet param ignored
          expect(config.restUrl).toBeTruthy();
          expect(config.wsUrl).toBeTruthy();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('should always return valid config for kucoin', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (testnet) => {
          const config = getExchangeConfig('kucoin', testnet);
          expect(config.name).toBe('kucoin');
          expect(config.testnet).toBe(false); // testnet param ignored
          expect(config.restUrl).toBeTruthy();
          expect(config.wsUrl).toBeTruthy();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('should include https in restUrl', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ExchangeName>('binance', 'bybit', 'kucoin'),
        fc.boolean(),
        (name, testnet) => {
          const config = getExchangeConfig(name, testnet);
          expect(config.restUrl.startsWith('https://')).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('should include wss in wsUrl', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ExchangeName>('binance', 'bybit', 'kucoin'),
        fc.boolean(),
        (name, testnet) => {
          const config = getExchangeConfig(name, testnet);
          expect(config.wsUrl.startsWith('wss://')).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('should throw for unsupported exchanges', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => !['binance', 'bybit', 'kucoin'].includes(s)),
        fc.boolean(),
        (name, testnet) => {
          expect(() => getExchangeConfig(name as ExchangeName, testnet)).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('binance testnet should have different URL than production', () => {
    const prod = getExchangeConfig('binance', false);
    const testnet = getExchangeConfig('binance', true);

    expect(prod.restUrl).not.toBe(testnet.restUrl);
    expect(prod.wsUrl).not.toBe(testnet.wsUrl);
    expect(prod.testnet).toBe(false);
    expect(testnet.testnet).toBe(true);
  });
});