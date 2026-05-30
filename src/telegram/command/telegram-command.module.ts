import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TelegramCoreModule } from '../core/telegram-core.module';
import { QueryHandlers } from './query/application/handlers';
import { MutationHandlers } from './mutation/application/handlers';
import { TelegramFormatter } from '@telegram/shared/formatters';
import { TradeRepositoryModule } from '@trade/repository/trade-repository.module';
import { TradeHistoryModule } from '@trade/history/trade-history.module';
import { TradeStatisticsModule } from '@trade/statistics/trade-statistics.module';
import { TradeListModule } from '@telegram/notification/trade-list/telegram-notification-trade-list.module';
import { TradeAlertsModule } from '@telegram/notification/trade-alerts/telegram-notification-single.module';
import { TradeApprovalModule } from '@telegram/notification/trade-approval/trade-approval.module';
import { PriceCacheModule } from '@price/cache/price-cache.module';

const CommandHandlers = [...QueryHandlers, ...MutationHandlers];

@Module({
  imports: [
    CqrsModule,
    forwardRef(() => TelegramCoreModule),
    forwardRef(() => TradeRepositoryModule),
    forwardRef(() => TradeHistoryModule),
    TradeStatisticsModule,
    forwardRef(() => TradeListModule),
    forwardRef(() => TradeAlertsModule),
    forwardRef(() => TradeApprovalModule),
    forwardRef(() => PriceCacheModule),
  ],
  providers: [
    ...CommandHandlers,
    TelegramFormatter,
  ],
  exports: [
    TelegramCoreModule,
  ],
})
export class TelegramCommandModule {}