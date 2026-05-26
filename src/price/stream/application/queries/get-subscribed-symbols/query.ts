import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PriceStreamService } from '../../../domain/services/price-stream.service';

/**
 * Query to get all currently subscribed symbols.
 */
export class GetSubscribedSymbolsQuery implements IQuery {}

/**
 * Result of GetSubscribedSymbolsQuery.
 */
export interface GetSubscribedSymbolsResult {
  symbols: string[];
}

@QueryHandler(GetSubscribedSymbolsQuery)
export class GetSubscribedSymbolsHandler implements IQueryHandler<GetSubscribedSymbolsQuery> {
  constructor(private readonly priceStream: PriceStreamService) {}

  async execute(_query: GetSubscribedSymbolsQuery): Promise<GetSubscribedSymbolsResult> {
    return {
      symbols: this.priceStream.getActiveSubscriptions(),
    };
  }
}