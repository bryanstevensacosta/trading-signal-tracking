import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { TradeEntity } from './trade/repository/infrastructure/persistence/trade.entity';
import { TradeIngestionModule } from './trade/ingestion/trade-ingestion.module';
import { TradeParsingModule } from './trade/parsing/trade-parsing.module';
import { TradeRepositoryModule } from './trade/repository/trade-repository.module';
import { TradeStateModule } from './trade/state/trade-state.module';
import { PriceExchangeModule } from '@price/exchange/price-exchange.module';
import { PriceStreamModule } from '@price/stream/price-stream.module';
import { TradeEngineModule } from './trade/engine/trade-engine.module';
import { TelegramCommandModule } from '@telegram/command/telegram-command.module';
import { LoggerModule } from './shared/shared.module';
import { HealthModule } from './health/health.module';

/**
 * Main application module.
 * Bootstraps all bounded context modules.
 */
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'crypto-signals.db',
      entities: [TradeEntity],
      synchronize: true,
    }),
    CqrsModule.forRoot(),
    TradeIngestionModule,
    TradeParsingModule,
    TradeRepositoryModule,
    TradeStateModule,
    PriceExchangeModule,
    PriceStreamModule,
    TradeEngineModule,
    TelegramCommandModule,
    HealthModule,
    LoggerModule,
  ],
})
export class AppModule {}