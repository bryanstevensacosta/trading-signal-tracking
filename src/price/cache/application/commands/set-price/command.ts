import { ICommand } from '@nestjs/cqrs';
import { Price } from '@trade/shared';

/**
 * Command to set a price in the cache.
 */
export class SetPriceCommand implements ICommand {
  constructor(public readonly price: Price) {}
}