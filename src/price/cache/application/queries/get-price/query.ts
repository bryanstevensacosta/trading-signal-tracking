import { IQuery } from '@nestjs/cqrs';

/**
 * Query to get a cached price by symbol.
 */
export class GetPriceQuery implements IQuery {
  constructor(public readonly symbol: string) {}
}