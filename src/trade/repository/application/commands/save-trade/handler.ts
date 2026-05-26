import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { SaveTradeCommand } from './command';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '../../../domain/ports/trade-repository.port';

/**
 * Handler for SaveTradeCommand.
 */
@CommandHandler(SaveTradeCommand)
export class SaveTradeHandler implements ICommandHandler<SaveTradeCommand> {
  constructor(@Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort) {}

  /**
   * Executes the save command.
   * @param command - SaveTradeCommand with input data
   * @returns Created trade
   */
  async execute(command: SaveTradeCommand) {
    return this.repository.save(command.input);
  }
}