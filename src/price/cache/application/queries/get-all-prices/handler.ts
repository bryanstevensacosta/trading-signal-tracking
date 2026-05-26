import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetAllPricesQuery } from './query';
import { PriceCacheService } from '../../../domain/services/price-cache.service';
import { Price } from '@trade/shared';

/**
 * Handler for GetAllPricesQuery.
 * Retrieves all cached prices.
 */
@QueryHandler(GetAllPricesQuery)
export class GetAllPricesHandler implements IQueryHandler<GetAllPricesQuery> {
  constructor(private readonly cache: PriceCacheService) {}

  /**
   * Executes the get all prices query.
   * @returns Array of all cached prices
   */
  async execute(_query: GetAllPricesQuery): Promise<Price[]> {
    return this.cache.getAll();
  }
}