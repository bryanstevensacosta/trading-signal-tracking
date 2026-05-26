import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { SetPriceCommand } from './command';
import { PriceCacheService } from '../../../domain/services/price-cache.service';

/**
 * Handler for SetPriceCommand.
 * Caches a price for quick access.
 */
@CommandHandler(SetPriceCommand)
export class SetPriceHandler implements ICommandHandler<SetPriceCommand> {
  constructor(private readonly cache: PriceCacheService) {}

  /**
   * Executes the set price command.
   * @param command - The set price command containing the price data
   */
  async execute(command: SetPriceCommand): Promise<void> {
    this.cache.set(command.price);
  }
}