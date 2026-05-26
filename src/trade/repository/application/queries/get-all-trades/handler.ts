import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetAllTradesQuery } from './query';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '../../../domain/ports/trade-repository.port';

/**
 * Handler for GetAllTradesQuery.
 */
@QueryHandler(GetAllTradesQuery)
export class GetAllTradesHandler implements IQueryHandler<GetAllTradesQuery> {
  constructor(@Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort) {}

  /**
   * Executes the query.
   * @returns All trades
   */
  async execute() {
    return this.repository.findAll();
  }
}