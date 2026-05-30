import { ICommand } from '@nestjs/cqrs';
import { ParsedTradeData } from '@trade/shared';

export class SendConfirmationCommand implements ICommand {
  constructor(
    public readonly parsedTrade: ParsedTradeData,
    public readonly chatId: number,
    public readonly sourceMessage: string,
  ) {}
}