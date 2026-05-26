import { ICommand } from '@nestjs/cqrs';

export class CleanDatabaseCommand implements ICommand {
  constructor(
    public readonly chatId: number,
  ) {}
}