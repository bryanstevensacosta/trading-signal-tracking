import { MarketType } from '@trade/shared';

export type ProviderName = 'binance' | 'bybit' | 'kucoin';

export interface ProviderConfig {
  name: ProviderName;
  restUrl: string;
  wsUrl: string;
  testnet: boolean;
  marketType: MarketType;
}

export const ProviderMarketType = {
  SPOT: MarketType.SPOT,
  FUTURES: MarketType.FUTURES,
} as const;