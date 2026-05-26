import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { DeleteTradeCommand } from './command';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '../../../domain/ports/trade-repository.port';

/**
 * Handler for DeleteTradeCommand.
 */
@CommandHandler(DeleteTradeCommand)
export class DeleteTradeHandler implements ICommandHandler<DeleteTradeCommand> {
  constructor(@Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort) {}

  /**
   * Executes the delete command.
   * @param command - DeleteTradeCommand with id
   * @returns True if deleted
   */
  async execute(command: DeleteTradeCommand) {
    return this.repository.delete(command.id);
  }
}