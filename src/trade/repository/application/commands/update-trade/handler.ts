import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateTradeCommand } from './command';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '../../../domain/ports/trade-repository.port';

/**
 * Handler for UpdateTradeCommand.
 */
@CommandHandler(UpdateTradeCommand)
export class UpdateTradeHandler implements ICommandHandler<UpdateTradeCommand> {
  constructor(@Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort) {}

  /**
   * Executes the update command.
   * @param command - UpdateTradeCommand with id and input data
   * @returns Updated trade
   */
  async execute(command: UpdateTradeCommand) {
    return this.repository.update(command.id, command.input);
  }
}