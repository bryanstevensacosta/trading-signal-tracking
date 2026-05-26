import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetTradeByIdQuery } from './query';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '../../../domain/ports/trade-repository.port';

/**
 * Handler for GetTradeByIdQuery.
 */
@QueryHandler(GetTradeByIdQuery)
export class GetTradeByIdHandler implements IQueryHandler<GetTradeByIdQuery> {
  constructor(@Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort) {}

  /**
   * Executes the query.
   * @param query - GetTradeByIdQuery with trade ID
   * @returns Trade or null
   */
  async execute(query: GetTradeByIdQuery) {
    return this.repository.findById(query.id);
  }
}