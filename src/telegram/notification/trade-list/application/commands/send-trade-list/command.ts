import { ICommand } from '@nestjs/cqrs';

export class SendTradeListCommand implements ICommand {
  constructor(
    public readonly chatId: number,
  ) {}
}