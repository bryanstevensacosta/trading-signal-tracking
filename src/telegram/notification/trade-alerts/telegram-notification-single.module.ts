import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TradeAlertService } from './domain/services/trade-alert.service';
import { OnStateChangedHandler, OnTriggerNotificationHandler, OnTradeModifiedHandler } from './application/event-handlers';
import { TradeStateModule } from '@trade/state/trade-state.module';
import { TradeEngineModule } from '@trade/engine/trade-engine.module';
import { TradeRepositoryModule } from '@trade/repository/trade-repository.module';
import { LoggerModule } from '@shared';
import { TelegramCoreModule } from '@telegram/core/telegram-core.module';
import { TelegramNotificationSharedModule } from '../shared/telegram-notification-shared.module';

const EventHandlers = [
  OnStateChangedHandler,
  OnTriggerNotificationHandler,
  OnTradeModifiedHandler,
];

@Module({
  imports: [
    CqrsModule,
    forwardRef(() => TradeStateModule),
    forwardRef(() => TradeEngineModule),
    TradeRepositoryModule,
    LoggerModule,
    forwardRef(() => TelegramCoreModule),
    TelegramNotificationSharedModule,
  ],
  providers: [
    TradeAlertService,
    ...EventHandlers,
  ],
  exports: [
    TradeAlertService,
  ],
})
export class TradeAlertsModule {}