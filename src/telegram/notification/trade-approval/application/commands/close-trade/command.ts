import { ICommand } from '@nestjs/cqrs';

export class CloseTradeConfirmationCommand implements ICommand {
  constructor(
    public readonly tradeId: string,
    public readonly chatId: number,
    public readonly reason?: string,
  ) {}
}