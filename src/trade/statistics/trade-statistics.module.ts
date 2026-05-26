import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TradeStatisticsService } from './domain/services/trade-statistics.service';
import { TradeHistoryModule } from '../history/trade-history.module';
import { GetTradeStatisticsHandler } from './application/queries/get-trade-statistics/handler';

const QueryHandlers = [GetTradeStatisticsHandler];

@Module({
  imports: [CqrsModule, TradeHistoryModule],
  providers: [TradeStatisticsService, ...QueryHandlers],
  exports: [TradeStatisticsService],
})
export class TradeStatisticsModule {}