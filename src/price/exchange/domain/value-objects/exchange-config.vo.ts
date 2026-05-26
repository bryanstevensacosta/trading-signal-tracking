import { MarketType } from '@trade/shared';

/**
 * Exchange name type.
 */
export type ExchangeName = 'binance' | 'bybit' | 'kucoin';

/**
 * Exchange configuration for connecting to an exchange.
 * 
 * @interface ExchangeConfig
 * @property name - The exchange identifier
 * @property restUrl - REST API base URL
 * @property wsUrl - WebSocket URL
 * @property testnet - Whether to use testnet
 * @property marketType - Market type (spot or futures)
 * 
 * @example
 * const config: ExchangeConfig = {
 *   name: 'binance',
 *   restUrl: 'https://api.binance.com',
 *   wsUrl: 'wss://stream.binance.com:9443',
 *   testnet: false,
 *   marketType: 'spot',
 * };
 */
export interface ExchangeConfig {
  name: ExchangeName;
  restUrl: string;
  wsUrl: string;
  testnet: boolean;
  marketType?: MarketType;
}

/**
 * Pre-configured Binance production settings.
 */
export const BINANCE_CONFIG: ExchangeConfig = {
  name: 'binance',
  restUrl: 'https://api.binance.com',
  wsUrl: 'wss://stream.binance.com:9443',
  testnet: false,
  marketType: MarketType.SPOT,
};

/**
 * Pre-configured Binance testnet settings.
 */
export const BINANCE_TESTNET_CONFIG: ExchangeConfig = {
  name: 'binance',
  restUrl: 'https://testnet.binance.vision',
  wsUrl: 'wss://testnet.binance.vision',
  testnet: true,
  marketType: MarketType.SPOT,
};

/**
 * Pre-configured Bybit settings.
 */
export const BYBIT_CONFIG: ExchangeConfig = {
  name: 'bybit',
  restUrl: 'https://api.bybit.com',
  wsUrl: 'wss://stream.bybit.com/v5/public/spot',
  testnet: false,
};

/**
 * Pre-configured KuCoin settings.
 */
export const KUCOIN_CONFIG: ExchangeConfig = {
  name: 'kucoin',
  restUrl: 'https://api.kucoin.com',
  wsUrl: 'wss://ws-api-spot.kucoin.com',
  testnet: false,
};

/**
 * Gets configuration for a named exchange.
 * 
 * @param name - The exchange name
 * @param testnet - Whether to use testnet (only applies to Binance)
 * @returns ExchangeConfig for the specified exchange
 */
export function getExchangeConfig(name: ExchangeName, testnet = false): ExchangeConfig {
  switch (name) {
    case 'binance':
      return testnet ? BINANCE_TESTNET_CONFIG : BINANCE_CONFIG;
    case 'bybit':
      return BYBIT_CONFIG;
    case 'kucoin':
      return KUCOIN_CONFIG;
    default:
      throw new Error(`Unsupported exchange: ${name}`);
  }
}