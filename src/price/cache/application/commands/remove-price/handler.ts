import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { RemovePriceCommand } from './command';
import { PriceCacheService } from '../../../domain/services/price-cache.service';

/**
 * Handler for RemovePriceCommand.
 * Removes a price from the cache.
 */
@CommandHandler(RemovePriceCommand)
export class RemovePriceHandler implements ICommandHandler<RemovePriceCommand> {
  constructor(private readonly cache: PriceCacheService) {}

  /**
   * Executes the remove price command.
   * @param command - The remove price command containing the symbol
   */
  async execute(command: RemovePriceCommand): Promise<void> {
    this.cache.remove(command.symbol);
  }
}