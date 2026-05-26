import { Price } from '@trade/shared';
import { ExchangeConfig } from '../value-objects/exchange-config.vo';

/**
 * Port interface for exchange operations.
 * Defines the contract for interacting with cryptocurrency exchanges.
 * 
 * @interface ExchangePort
 * 
 * @example
 * class BinanceExchangeAdapter implements ExchangePort {
 *   async connect(): Promise<void> { ... }
 *   async getTicker(symbol: string): Promise<Price> { ... }
 *   subscribeToTicker(symbol: string, callback: (price: Price) => void): () => void { ... }
 * }
 */
export interface ExchangePort {
  /**
   * Establishes connection to the exchange.
   * 
   * @returns Promise that resolves when connected
   * @throws ExchangeConnectionError if connection fails
   */
  connect(): Promise<void>;

  /**
   * Closes connection to the exchange.
   * 
   * @returns Promise that resolves when disconnected
   */
  disconnect(): Promise<void>;

  /**
   * Checks if currently connected to the exchange.
   * 
   * @returns True if connected, false otherwise
   */
  isConnected(): boolean;

  /**
   * Gets current price ticker for a symbol via REST API.
   * 
   * @param symbol - Trading symbol (e.g., 'BTCUSDT')
   * @returns Promise resolving to current Price
   * @throws SymbolNotFoundError if symbol not found
   */
  getTicker(symbol: string): Promise<Price>;

  /**
   * Gets current price tickers for multiple symbols via REST API.
   * 
   * @param symbols - Array of trading symbols
   * @returns Promise resolving to array of Prices
   */
  getMultipleTickers(symbols: string[]): Promise<Price[]>;

  /**
   * Subscribes to real-time ticker updates for a single symbol.
   * 
   * @param symbol - Trading symbol
   * @param callback - Function called with updated Price
   * @returns Unsubscribe function - call to stop receiving updates
   * 
   * @example
   * const unsubscribe = exchange.subscribeToTicker('BTCUSDT', (price) => {
   *   console.log('BTCUSDT:', price.last);
   * });
   * // Later: unsubscribe();
   */
  subscribeToTicker(symbol: string, callback: (price: Price) => void): () => void;

  /**
   * Subscribes to real-time ticker updates for multiple symbols.
   * 
   * @param symbols - Array of trading symbols
   * @param callback - Function called with updated Prices
   * @returns Unsubscribe function - call to stop receiving updates
   */
  subscribeToMultipleTickers(symbols: string[], callback: (prices: Price[]) => void): () => void;

  /**
   * Gets the exchange configuration.
   * 
   * @returns ExchangeConfig for this exchange
   */
  getConfig(): ExchangeConfig;
}