import { Trade, CreateTradeInput, UpdateTradeInput } from '@trade/shared';

export const TRADE_REPOSITORY_PORT = 'TRADE_REPOSITORY_PORT';

/**
 * Port for trade persistence operations.
 * @see Ports in domain define interfaces, infrastructure implements them.
 */
export interface TradeRepositoryPort {
  /**
   * Creates a new trade.
   * @param input - Trade creation data
   * @returns Created trade
   */
  save(input: CreateTradeInput): Promise<Trade>;

  /**
   * Finds a trade by ID.
   * @param id - Trade ID
   * @returns Trade or null if not found
   */
  findById(id: string): Promise<Trade | null>;

  /**
   * Retrieves all trades.
   * @returns Array of trades
   */
  findAll(): Promise<Trade[]>;

  /**
   * Retrieves all active trades.
   * @returns Array of active trades
   */
  findActive(): Promise<Trade[]>;

  /**
   * Retrieves all pending trades.
   * @returns Array of pending trades
   */
  findPending(): Promise<Trade[]>;

  /**
   * Finds trades by status.
   * @param status - Trade status to filter
   * @returns Array of matching trades
   */
  findByStatus(status: string): Promise<Trade[]>;

  /**
   * Finds trades by symbol.
   * @param symbol - Trading symbol
   * @returns Array of matching trades
   */
  findBySymbol(symbol: string): Promise<Trade[]>;

  /**
   * Updates a trade.
   * @param id - Trade ID
   * @param input - Update data
   * @returns Updated trade or null
   */
  update(id: string, input: UpdateTradeInput): Promise<Trade | null>;

  /**
   * Deletes a trade.
   * @param id - Trade ID
   * @returns True if deleted
   */
  delete(id: string): Promise<boolean>;

  /**
   * Deletes all trades.
   * @returns Number of trades deleted
   */
  deleteAll(): Promise<number>;
}