import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ParseTradeCommand } from './command';
import { ParserService } from '../../../domain/services/parser.service';
import { ParseResult } from '../../../domain/ports/parser.port';

/**
 * Handler for ParseTradeCommand.
 * Parses and validates Telegram trade messages.
 */
@CommandHandler(ParseTradeCommand)
export class ParseTradeHandler implements ICommandHandler<ParseTradeCommand> {
  constructor(private readonly parserService: ParserService) {}

  /**
   * Executes the parse command.
   * @param command - ParseTradeCommand with message
   * @returns Parsed and validated trade data
   */
  async execute(command: ParseTradeCommand): Promise<ParseResult> {
    return this.parserService.parse(command.message);
  }
}