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
    public readonly exportCsv?: boolean,
  ) {}
}

export class GetActiveTradesCommand implements ICommand {}

export class GetTradeByIdCommand implements ICommand {
  constructor(public readonly tradeId: string) {}
}

export class GetStatsCommand implements ICommand {}

export class GetShareCardPositionPnlCommand implements ICommand {
  constructor(public readonly tradeId: string) {}
}

export class GetShareCardAccountPnlCommand implements ICommand {
  constructor(public readonly period: '24h' | '7d' | '30d' | 'all' = '24h') {}
}