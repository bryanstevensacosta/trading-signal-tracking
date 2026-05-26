import { ICommand } from '@nestjs/cqrs';

/**
 * Command to remove a price from the cache.
 */
export class RemovePriceCommand implements ICommand {
  constructor(public readonly symbol: string) {}
}