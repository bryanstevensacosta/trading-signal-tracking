import { Injectable, Inject } from '@nestjs/common';
import { ParserPort, ParseResult, PARSER_PORT } from '../ports/parser.port';
import { TradeValidator } from './trade-validator';

/**
 * Domain service for parsing and validating trade messages.
 * Orchestrates parsing and validation logic.
 */
@Injectable()
export class ParserService {
  constructor(
    private readonly validator: TradeValidator,
    @Inject(PARSER_PORT) private readonly parser: ParserPort,
  ) {}

  /**
   * Parses a message and validates the extracted data.
   * @param message - Raw Telegram message
   * @returns Validated parse result
   */
  async parse(message: string): Promise<ParseResult> {
    const result = this.parser.parse(message);

    if (!result.success || !result.data) {
      return result;
    }

    const validation = this.validator.validateTrade(
      result.data.symbol,
      result.data.side,
      result.data.entry,
      result.data.sl,
      result.data.tps
    );

    return {
      ...result,
      success: validation.valid,
      errors: [...result.errors, ...validation.errors],
    };
  }
}