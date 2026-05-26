import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { TradeEntity } from './infrastructure/persistence/trade.entity';
import { SqliteTradeAdapter } from './infrastructure/adapters/sqlite-trade.adapter';
import { TRADE_PORT_TOKEN } from '@telegram/command/domain/ports/trade.port';
import { TRADE_REPOSITORY_PORT } from './domain/ports/trade-repository.port';
import { SaveTradeHandler } from './application/commands/save-trade/handler';
import { UpdateTradeHandler } from './application/commands/update-trade/handler';
import { DeleteTradeHandler } from './application/commands/delete-trade/handler';
import { GetTradeByIdHandler } from './application/queries/get-trade-by-id/handler';
import { GetAllTradesHandler } from './application/queries/get-all-trades/handler';
import { GetActiveTradesHandler } from './application/queries/get-active-trades/handler';

const CommandHandlers = [SaveTradeHandler, UpdateTradeHandler, DeleteTradeHandler];
const QueryHandlers = [GetTradeByIdHandler, GetAllTradesHandler, GetActiveTradesHandler];

@Module({
  imports: [TypeOrmModule.forFeature([TradeEntity]), CqrsModule],
  providers: [
    SqliteTradeAdapter,
    {
      provide: TRADE_PORT_TOKEN,
      useFactory: (adapter: SqliteTradeAdapter) => adapter,
      inject: [SqliteTradeAdapter],
    },
    {
      provide: TRADE_REPOSITORY_PORT,
      useClass: SqliteTradeAdapter,
    },
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [SqliteTradeAdapter, TRADE_PORT_TOKEN, TRADE_REPOSITORY_PORT],
})
export class TradeRepositoryModule {}