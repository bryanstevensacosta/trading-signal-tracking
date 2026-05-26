import { ICommand } from '@nestjs/cqrs';

/**
 * Command to delete a trade.
 */
export class DeleteTradeCommand implements ICommand {
  constructor(public readonly id: string) {}
}