import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { TradeEntity } from './trade/repository/infrastructure/persistence/trade.entity';
import { TelegramNotificationLogEntity } from './telegram/notification/shared/domain/entities/telegram-notification-log.entity';
import { TradeIngestionModule } from './trade/ingestion/trade-ingestion.module';
import { TradeParsingModule } from './trade/parsing/trade-parsing.module';
import { TradeRepositoryModule } from './trade/repository/trade-repository.module';
import { TradeStateModule } from './trade/state/trade-state.module';
import { BinanceProviderModule } from '@price/provider/binance/binance.module';
import { PriceStreamModule } from '@price/stream/price-stream.module';
import { TriggerModule } from './trade/trigger/trigger.module';
import { TelegramCommandModule } from '@telegram/cmd/telegram-command.module';
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
      database: 'trading-signal-tracker.db',
      entities: [TradeEntity, TelegramNotificationLogEntity],
      synchronize: true,
    }),
    CqrsModule.forRoot(),
    TradeIngestionModule,
    TradeParsingModule,
    TradeRepositoryModule,
    TradeStateModule,
    BinanceProviderModule,
    PriceStreamModule,
    TriggerModule,
    TelegramCommandModule,
    HealthModule,
    LoggerModule,
  ],
})
export class AppModule {}