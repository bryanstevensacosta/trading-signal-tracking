import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetActiveTradesQuery } from './query';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '../../../domain/ports/trade-repository.port';

/**
 * Handler for GetActiveTradesQuery.
 */
@QueryHandler(GetActiveTradesQuery)
export class GetActiveTradesHandler implements IQueryHandler<GetActiveTradesQuery> {
  constructor(@Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort) {}

  /**
   * Executes the query.
   * @returns Active trades
   */
  async execute() {
    return this.repository.findActive();
  }
}