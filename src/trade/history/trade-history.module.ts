import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TradeHistoryService } from './domain/services/trade-history.service';
import { TradeHistoryAdapter } from './infrastructure/adapters/trade-history.adapter';
import { TRADE_HISTORY_PORT } from './domain/ports/trade-history.port';
import { TradeRepositoryModule } from '../repository/trade-repository.module';
import { GetClosedTradesHandler } from './application/queries/get-closed-trades/handler';

const QueryHandlers = [GetClosedTradesHandler];

@Module({
  imports: [CqrsModule, TradeRepositoryModule],
  providers: [
    TradeHistoryService,
    {
      provide: TRADE_HISTORY_PORT,
      useClass: TradeHistoryAdapter,
    },
    TradeHistoryAdapter,
    ...QueryHandlers,
  ],
  exports: [TradeHistoryService, TRADE_HISTORY_PORT],
})
export class TradeHistoryModule {}