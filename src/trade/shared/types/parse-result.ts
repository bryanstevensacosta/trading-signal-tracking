import { ParsedTradeData } from './parsed-trade';

/**
 * Result of parsing a Telegram trade message.
 */
export interface ParseResult {
  success: boolean;
  data: ParsedTradeData | null;
  errors: string[];
}