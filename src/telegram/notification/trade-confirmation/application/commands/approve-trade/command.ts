import { ICommand } from '@nestjs/cqrs';

export class ApproveTradeCommand implements ICommand {
  constructor(
    public readonly tradeId: string,
    public readonly chatId: number,
  ) {}
}