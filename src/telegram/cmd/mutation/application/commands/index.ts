import { ICommand } from '@nestjs/cqrs';

export class CancelTradeCommand implements ICommand {
  constructor(
    public readonly tradeId: string,
    public readonly chatId: number,
  ) {}
}

export class DeleteTradeCommand implements ICommand {
  constructor(
    public readonly tradeId: string,
    public readonly chatId: number,
  ) {}
}

export class ModifyEntryCommand implements ICommand {
  constructor(
    public readonly tradeId: string,
    public readonly newEntry: number,
    public readonly chatId: number,
  ) {}
}

export class ModifySLCommand implements ICommand {
  constructor(
    public readonly tradeId: string,
    public readonly newSL: number,
    public readonly chatId: number,
  ) {}
}

export class ModifyTPCommand implements ICommand {
  constructor(
    public readonly tradeId: string,
    public readonly tpIndex: number,
    public readonly newTP: number,
    public readonly chatId: number,
  ) {}
}

export class CloseTradeCommand implements ICommand {
  constructor(
    public readonly tradeId: string,
    public readonly chatId: number,
    public readonly reason?: string,
  ) {}
}

export class MoveToBreakevenCommand implements ICommand {
  constructor(
    public readonly tradeId: string,
    public readonly chatId: number,
  ) {}
}

export class ForceOpenCommand implements ICommand {
  constructor(
    public readonly tradeId: string,
    public readonly chatId: number,
  ) {}
}

export class CleanDatabaseCommand implements ICommand {
  constructor(
    public readonly chatId: number,
  ) {}
}