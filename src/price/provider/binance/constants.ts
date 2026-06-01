import { ProviderConfig, MarketType } from '@price/provider/shared';

export const BINANCE_SPOT_REST_URL = 'https://api.binance.com';
export const BINANCE_SPOT_WS_URL = 'wss://stream.binance.com:9443/ws';
export const BINANCE_SPOT_COMBINED_WS_URL = 'wss://stream.binance.com:9443/stream';

export const BINANCE_FUTURES_REST_URL = 'https://fapi.binance.com';
export const BINANCE_FUTURES_WS_URL = 'wss://fstream.binance.com/ws';
export const BINANCE_FUTURES_COMBINED_WS_URL = 'wss://fstream.binance.com/stream';

export const BINANCE_TESTNET_REST_URL = 'https://testnet.binance.vision';
export const BINANCE_TESTNET_WS_URL = 'wss://testnet.binance.vision';

export const BINANCE_SPOT_CONFIG: ProviderConfig = {
  name: 'binance',
  restUrl: BINANCE_SPOT_REST_URL,
  wsUrl: BINANCE_SPOT_WS_URL,
  testnet: false,
  marketType: MarketType.SPOT,
};

export const BINANCE_FUTURES_CONFIG: ProviderConfig = {
  name: 'binance',
  restUrl: BINANCE_FUTURES_REST_URL,
  wsUrl: BINANCE_FUTURES_WS_URL,
  testnet: false,
  marketType: MarketType.FUTURES,
};

export const BINANCE_SPOT_TESTNET_CONFIG: ProviderConfig = {
  name: 'binance',
  restUrl: BINANCE_TESTNET_REST_URL,
  wsUrl: BINANCE_TESTNET_WS_URL,
  testnet: true,
  marketType: MarketType.SPOT,
};