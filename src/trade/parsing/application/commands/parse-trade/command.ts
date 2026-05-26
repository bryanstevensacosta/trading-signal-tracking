import { ICommand } from '@nestjs/cqrs';

/**
 * Command to parse a Telegram trade message.
 */
export class ParseTradeCommand implements ICommand {
  constructor(public readonly message: string) {}
}