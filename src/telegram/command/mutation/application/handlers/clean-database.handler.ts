import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CleanDatabaseCommand } from '../commands';
import { TRADE_REPOSITORY_PORT, TradeRepositoryPort } from '@trade/repository/domain/ports/trade-repository.port';
import { CommandResponse } from '../../../../command/application/command-response';

@CommandHandler(CleanDatabaseCommand)
export class CleanDatabaseHandler implements ICommandHandler<CleanDatabaseCommand> {
  constructor(
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
  ) {}

  async execute(_command: CleanDatabaseCommand): Promise<CommandResponse> {
    const deletedCount = await this.repository.deleteAll();

    return {
      success: true,
      message: `🧹 Base de datos limpiada. ${deletedCount} trades eliminados.`,
    };
  }
}