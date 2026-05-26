import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CleanDatabaseCommand } from '../commands/mutation/clean-database.command';
import { TRADE_PORT_TOKEN, TradePort } from '../../domain/ports';
import { CommandResponse } from '../../application/command-response';

@CommandHandler(CleanDatabaseCommand)
export class CleanDatabaseHandler implements ICommandHandler<CleanDatabaseCommand> {
  constructor(
    @Inject(TRADE_PORT_TOKEN) private readonly repository: TradePort,
  ) {}

  async execute(_command: CleanDatabaseCommand): Promise<CommandResponse> {
    const deletedCount = await this.repository.deleteAll();

    return {
      success: true,
      message: `🧹 Base de datos limpiada. ${deletedCount} trades eliminados.`,
    };
  }
}