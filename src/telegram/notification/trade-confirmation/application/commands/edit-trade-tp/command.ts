import { ICommand } from '@nestjs/cqrs';

export class EditTradeTPCommand implements ICommand {
  constructor(
    public readonly tradeId: string,
    public readonly action: 'add' | 'remove',
    public readonly chatId: number,
    public readonly value?: string,
  ) {}
}