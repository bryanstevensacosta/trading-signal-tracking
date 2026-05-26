import { ICommand } from '@nestjs/cqrs';
import { CreateTradeInput } from '@trade/shared';

/**
 * Command to create a new trade.
 */
export class SaveTradeCommand implements ICommand {
  constructor(public readonly input: CreateTradeInput) {}
}