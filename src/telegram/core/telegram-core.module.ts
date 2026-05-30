import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TelegrafCoreAdapter } from './infrastructure/adapters/telegraf-core.adapter';
import { TELEGRAM_PORT } from './domain/ports/telegram.port';
import { CommandHandlerService, TextHandlerService, CallbackHandlerService, HandlerOrchestratorService } from './infrastructure/services';
import { CommandRouterService } from './domain/services/command-router.service';
import { TradeValidationService } from '@trade/domain';
import { TelegramFormatter } from '../shared/formatters';
import { TradeRepositoryModule } from '@trade/repository/trade-repository.module';
import { TradeHistoryModule } from '@trade/history/trade-history.module';
import { TradeStatisticsModule } from '@trade/statistics/trade-statistics.module';
import { TradeApprovalModule } from '../notification/trade-approval/trade-approval.module';
import { TradeListModule } from '../notification/trade-list/telegram-notification-trade-list.module';
import { PriceCacheModule } from '@price/cache/price-cache.module';
import { LoggerModule } from '@shared';
import { TradeStateModule } from '@trade/state/trade-state.module';

const CommandHandlers = [
  CommandHandlerService,
  TextHandlerService,
  CallbackHandlerService,
  HandlerOrchestratorService,
];

@Module({
  imports: [
    CqrsModule,
    forwardRef(() => TradeRepositoryModule),
    TradeHistoryModule,
    TradeStatisticsModule,
    forwardRef(() => TradeApprovalModule),
    forwardRef(() => TradeListModule),
    PriceCacheModule,
    LoggerModule,
    forwardRef(() => TradeStateModule),
  ],
  providers: [
    TelegrafCoreAdapter,
    {
      provide: TELEGRAM_PORT,
      useExisting: TelegrafCoreAdapter,
    },
    CommandRouterService,
    TradeValidationService,
    TelegramFormatter,
    ...CommandHandlers,
  ],
  exports: [
    TELEGRAM_PORT,
    TelegrafCoreAdapter,
    CommandRouterService,
    TradeValidationService,
    TelegramFormatter,
    TelegramCoreModule,
  ],
})
export class TelegramCoreModule {}