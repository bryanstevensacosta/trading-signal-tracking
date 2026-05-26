import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { NotificationTemplateService } from './domain/services/notification-template.service';
import { TelegramMessageAdapter } from './infrastructure/adapters/telegram-message.adapter';
import { OnStateChangedHandler, OnTriggerNotificationHandler, OnTradeModifiedHandler } from './application/event-handlers';
import { TradeStateModule } from '@trade/state/trade-state.module';
import { TradeEngineModule } from '@trade/engine/trade-engine.module';
import { TradeRepositoryModule } from '@trade/repository/trade-repository.module';
import { TELEGRAM_PORT } from './domain/ports/telegram.port';
import { LoggerModule } from '@shared';

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
  ],
  providers: [
    { provide: TELEGRAM_PORT, useClass: TelegramMessageAdapter },
    NotificationTemplateService,
    ...EventHandlers,
  ],
  exports: [
    NotificationTemplateService,
    TELEGRAM_PORT,
  ],
})
export class TelegramNotificationSingleModule {}