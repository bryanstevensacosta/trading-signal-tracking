export const BINANCE_INFO_PORT = 'BINANCE_INFO_PORT';

export interface BinanceInfo {
  price: number;
  change24hPercent: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  symbol: string;
}

export interface BinanceInfoPort {
  getTickerInfo(symbol: string, isFutures: boolean): Promise<BinanceInfo>;
}