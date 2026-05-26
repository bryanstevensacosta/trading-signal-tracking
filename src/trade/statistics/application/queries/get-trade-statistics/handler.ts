import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetTradeStatisticsQuery } from './query';
import { TradeStatisticsService } from '../../../domain/services/trade-statistics.service';
import { TradeStatistics } from '../../../domain/ports/trade-statistics.port';

@QueryHandler(GetTradeStatisticsQuery)
export class GetTradeStatisticsHandler implements IQueryHandler<GetTradeStatisticsQuery> {
  constructor(
    private readonly statisticsService: TradeStatisticsService,
  ) {}

  async execute(_query: GetTradeStatisticsQuery): Promise<TradeStatistics> {
    return this.statisticsService.calculateStatisticsFromHistory();
  }
}