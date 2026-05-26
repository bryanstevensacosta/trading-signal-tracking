import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CommandRouterService } from './domain/services/command-router.service';
import { ValidationService } from './domain/services/validation.service';
import { TradeFormatterService } from './domain/services/trade-formatter.service';
import { TelegramBotAdapter } from './infrastructure/adapters/telegram-bot.adapter';
import { TradeRepositoryModule } from '@trade/repository/trade-repository.module';
import { TradeHistoryModule } from '@trade/history/trade-history.module';
import { TradeStatisticsModule } from '@trade/statistics/trade-statistics.module';
import { TradeConfirmationModule } from '@telegram/notification/trade-confirmation/trade-confirmation.module';
import { TelegramNotificationTradeListModule } from '@telegram/notification/trade-list/telegram-notification-trade-list.module';
import { PriceCacheModule } from '@price/cache/price-cache.module';
import { LoggerModule } from '@shared';
import {
  StartHandler,
  HelpHandler,
  GetTradesHandler,
  GetActiveTradesHandler,
  GetTradeByIdHandler,
  GetStatsHandler,
  CancelTradeHandler,
  DeleteTradeHandler,
  ModifyEntryHandler,
  ModifySLHandler,
  ModifyTPHandler,
  CloseTradeHandler,
  MoveToBreakevenHandler,
  ForceOpenHandler,
} from './application/handlers';

const CommandHandlers = [
  StartHandler,
  HelpHandler,
  GetTradesHandler,
  GetActiveTradesHandler,
  GetTradeByIdHandler,
  GetStatsHandler,
  CancelTradeHandler,
  DeleteTradeHandler,
  ModifyEntryHandler,
  ModifySLHandler,
  ModifyTPHandler,
  CloseTradeHandler,
  MoveToBreakevenHandler,
  ForceOpenHandler,
];

@Module({
  imports: [
    CqrsModule,
    forwardRef(() => TradeRepositoryModule),
    TradeHistoryModule,
    TradeStatisticsModule,
    TradeConfirmationModule,
    TelegramNotificationTradeListModule,
    PriceCacheModule,
    LoggerModule,
  ],
  providers: [
    CommandRouterService,
    ValidationService,
    TradeFormatterService,
    TelegramBotAdapter,
    ...CommandHandlers,
  ],
  exports: [
    CommandRouterService,
    ValidationService,
    TradeFormatterService,
  ],
})
export class TelegramCommandModule {}