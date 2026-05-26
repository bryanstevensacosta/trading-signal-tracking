import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetPriceQuery } from './query';
import { PriceCacheService } from '../../../domain/services/price-cache.service';
import { Price } from '@trade/shared';

/**
 * Handler for GetPriceQuery.
 * Retrieves a cached price by symbol.
 */
@QueryHandler(GetPriceQuery)
export class GetPriceHandler implements IQueryHandler<GetPriceQuery> {
  constructor(private readonly cache: PriceCacheService) {}

  /**
   * Executes the get price query.
   * @param query - The get price query containing the symbol
   * @returns The cached price or null
   */
  async execute(query: GetPriceQuery): Promise<Price | null> {
    return this.cache.get(query.symbol);
  }
}