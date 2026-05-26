import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetClosedTradesQuery } from './query';
import { TradeHistoryService } from '../../../domain/services/trade-history.service';
import { Trade } from '../../../../shared/types';

export interface GetClosedTradesResponse {
  trades: Trade[];
  total: number;
}

@QueryHandler(GetClosedTradesQuery)
export class GetClosedTradesHandler implements IQueryHandler<GetClosedTradesQuery> {
  constructor(
    private readonly historyService: TradeHistoryService,
  ) {}

  async execute(query: GetClosedTradesQuery): Promise<GetClosedTradesResponse> {
    const [trades, total] = await Promise.all([
      this.historyService.findClosedTrades(query.filters),
      this.historyService.getClosedTradesCount(query.filters),
    ]);

    return { trades, total };
  }
}