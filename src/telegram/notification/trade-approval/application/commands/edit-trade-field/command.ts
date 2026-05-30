import { ICommand } from '@nestjs/cqrs';

export class EditTradeFieldCommand implements ICommand {
  constructor(
    public readonly tradeId: string,
    public readonly field: string,
    public readonly value: string,
    public readonly chatId: number,
  ) {}
}