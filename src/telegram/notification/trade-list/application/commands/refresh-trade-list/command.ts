import { ICommand } from '@nestjs/cqrs';

export class RefreshTradeListCommand implements ICommand {
  constructor(
    public readonly chatId: number,
  ) {}
}