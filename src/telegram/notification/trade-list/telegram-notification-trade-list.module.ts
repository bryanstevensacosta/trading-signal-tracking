import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TradeListService } from './domain/services/trade-list.service';
import { TradeListCacheService } from './domain/services/trade-list-cache.service';
import { NotificationBatcherService } from './domain/services/notification-batcher.service';
import { SendTradeListHandler } from './application/commands/send-trade-list/handler';
import { RefreshTradeListHandler } from './application/commands/refresh-trade-list/handler';
import { OnTradeListRefreshHandler } from './application/event-handlers/on-state-changed.handler';
import { TradeRepositoryModule } from '@trade/repository/trade-repository.module';
import { TradeAlertsModule } from '@telegram/notification/trade-alerts/telegram-notification-single.module';
import { TradeListNotifierAdapterProvider } from './infrastructure/adapters/trade-list-notifier.adapter';
import { PriceCacheModule } from '@price/cache/price-cache.module';
import { LoggerModule } from '@shared';
import { TelegramCoreModule } from '@telegram/core/telegram-core.module';
import { TelegramNotificationSharedModule } from '../shared/telegram-notification-shared.module';

const CommandHandlers = [SendTradeListHandler, RefreshTradeListHandler];
const EventHandlers = [OnTradeListRefreshHandler];

@Module({
  imports: [
    CqrsModule,
    forwardRef(() => TradeRepositoryModule),
    forwardRef(() => TradeAlertsModule),
    forwardRef(() => PriceCacheModule),
    LoggerModule,
    forwardRef(() => TelegramCoreModule),
    TelegramNotificationSharedModule,
  ],
  providers: [
    TradeListService,
    TradeListCacheService,
    NotificationBatcherService,
    TradeListNotifierAdapterProvider,
    ...CommandHandlers,
    ...EventHandlers,
  ],
  exports: [
    TradeListService,
    TradeListCacheService,
    NotificationBatcherService,
  ],
})
export class TradeListModule {}