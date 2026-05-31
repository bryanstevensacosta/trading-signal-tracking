import { Price } from '@trade/shared';
import { ProviderConfig } from '@price/provider/shared';

export interface BinanceSpotPort {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getTicker(symbol: string): Promise<Price>;
  getMultipleTickers(symbols: string[]): Promise<Price[]>;
  subscribeToTicker(symbol: string, callback: (price: Price) => void): () => void;
  subscribeToMultipleTickers(symbols: string[], callback: (prices: Price[]) => void): () => void;
  getConfig(): ProviderConfig;
  symbolExists(symbol: string): Promise<boolean>;
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