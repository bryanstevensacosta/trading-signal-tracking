import { ICommand } from '@nestjs/cqrs';
import { UpdateTradeInput } from '@trade/shared';

/**
 * Command to update an existing trade.
 */
export class UpdateTradeCommand implements ICommand {
  constructor(
    public readonly id: string,
    public readonly input: UpdateTradeInput,
  ) {}
}