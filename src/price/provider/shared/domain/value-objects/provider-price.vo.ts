import { Price, MarketType } from '@trade/shared';

export interface ProviderPrice extends Price {
  volume24h?: number;
  high24h?: number;
  low24h?: number;
}

export interface ProviderPriceWithExchange extends ProviderPrice {
  exchange: string;
  marketType: MarketType;
}

export interface ProviderKline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

export interface CreateProviderPriceInput {
  symbol: string;
  bidPrice?: string | number;
  askPrice?: string | number;
  lastPrice?: string | number;
  volume?: string | number;
  high24h?: string | number;
  low24h?: string | number;
  closeTime?: number;
}

export function createProviderPrice(data: CreateProviderPriceInput, exchange: string, marketType: MarketType): ProviderPriceWithExchange {
  const parseNumber = (value: string | number | undefined): number => {
    if (value === undefined || value === null) return 0;
    return typeof value === 'string' ? parseFloat(value) : value;
  };

  return {
    symbol: data.symbol.toUpperCase(),
    bid: parseNumber(data.bidPrice),
    ask: parseNumber(data.askPrice),
    last: parseNumber(data.lastPrice),
    volume24h: parseNumber(data.volume),
    high24h: parseNumber(data.high24h),
    low24h: parseNumber(data.low24h),
    timestamp: new Date(data.closeTime || Date.now()),
    exchange,
    marketType,
  };
}