import { TradeSide, OrderType } from '@trade/shared';

export const PARSER_PORT = 'PARSER_PORT';

/**
 * Result of parsing a Telegram trade message.
 */
export interface ParseResult {
  success: boolean;
  data: {
    symbol: string;
    side: TradeSide;
    orderType: OrderType;
    entry: number;
    entryMax: number | null;
    sl: number | null;
    tps: number[] | null;
    chartUrl: string | null;
    notes: string | null;
  } | null;
  errors: string[];
}

/**
 * Port for parsing Telegram trade messages.
 */
export interface ParserPort {
  /**
   * Parses a raw Telegram message into structured trade data.
   * @param message - Raw message text
   * @returns Parsed result with extracted fields
   */
  parse(message: string): ParseResult;
}