import { Price } from '@trade/shared';
import { ExchangeConfig } from '../../domain/value-objects/exchange-config.vo';

/**
 * Port interface for Binance Spot exchange operations.
 * Defines the contract for interacting with Binance Spot API.
 */
export interface BinanceSpotPort {
  /**
   * Establishes connection to Binance Spot API.
   * 
   * @returns Promise that resolves when connected
   * @throws ExchangeConnectionError if connection fails
   */
  connect(): Promise<void>;

  /**
   * Closes connection to the exchange.
   */
  disconnect(): Promise<void>;

  /**
   * Checks if currently connected.
   */
  isConnected(): boolean;

  /**
   * Gets current price ticker for a symbol via REST API.
   * 
   * @param symbol - Trading symbol (e.g., 'BTCUSDT')
   * @returns Promise resolving to Price with marketType 'spot'
   */
  getTicker(symbol: string): Promise<Price>;

  /**
   * Gets current price tickers for multiple symbols.
   */
  getMultipleTickers(symbols: string[]): Promise<Price[]>;

  /**
   * Subscribes to real-time ticker updates for a single symbol.
   * 
   * @param symbol - Trading symbol
   * @param callback - Function called with updated Price
   * @returns Unsubscribe function
   */
  subscribeToTicker(symbol: string, callback: (price: Price) => void): () => void;

  /**
   * Subscribes to real-time ticker updates for multiple symbols.
   */
  subscribeToMultipleTickers(symbols: string[], callback: (prices: Price[]) => void): () => void;

  /**
   * Gets the exchange configuration.
   */
  getConfig(): ExchangeConfig;

  /**
   * Checks if a symbol exists in Spot exchange.
   */
  symbolExists(symbol: string): Promise<boolean>;
}