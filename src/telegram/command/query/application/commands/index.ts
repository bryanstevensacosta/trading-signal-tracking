import { ICommand } from '@nestjs/cqrs';

export class StartCommand implements ICommand {
  constructor(public readonly chatId: number) {}
}

export class HelpCommand implements ICommand {
  constructor(public readonly chatId: number) {}
}

export class GetTradesCommand implements ICommand {
  constructor(
    public readonly filter?: 'all' | 'active' | 'pending' | 'closed' | 'history',
    public readonly page: number = 1,
  ) {}
}

export class GetActiveTradesCommand implements ICommand {}

export class GetTradeByIdCommand implements ICommand {
  constructor(public readonly tradeId: string) {}
}

export class GetStatsCommand implements ICommand {}