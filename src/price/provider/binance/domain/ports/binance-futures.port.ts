import { Price } from '@trade/shared';
import { ProviderConfig } from '@price/provider/shared';

export interface BinanceFuturesPort {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getTicker(symbol: string): Promise<Price>;
  getMultipleTickers(symbols: string[]): Promise<Price[]>;
  getMarkPrice(symbol: string): Promise<{ markPrice: number; indexPrice: number; fundingRate: number }>;
  subscribeToTicker(symbol: string, callback: (price: Price) => void): () => void;
  subscribeToMarkPrice(symbol: string, callback: (markPrice: number) => void): () => void;
  subscribeToMultipleTickers(symbols: string[], callback: (prices: Price[]) => void): () => void;
  getConfig(): ProviderConfig;
  symbolExists(symbol: string): Promise<boolean>;
  getSymbolPrecision(symbol: string): number;
  roundToPrecision(value: number, precision: number): number;
  getKlines(
    symbol: string,
    interval?: string,
    startTime?: number,
    endTime?: number,
    limit?: number
  ): Promise<Array<{
    openTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    closeTime: number;
  }>>;
}