import { ICommand } from '@nestjs/cqrs';

export class CancelTradeConfirmationCommand implements ICommand {
  constructor(
    public readonly tradeId: string,
    public readonly chatId: number,
  ) {}
}