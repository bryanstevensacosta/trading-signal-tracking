import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BinanceInfoService } from './domain/services/binance-info.service';
import { TradeApprovalService } from './domain/services/confirmation-template.service';
import { EditStateManager } from './domain/services/edit-state-manager.service';
import { SendConfirmationHandler } from './application/commands/send-confirmation/handler';
import { ApproveTradeHandler } from './application/commands/approve-trade/handler';
import { CancelTradeHandler } from './application/commands/cancel-trade/handler';
import { EditTradeFieldHandler } from './application/commands/edit-trade-field/handler';
import { EditTradeTPHandler } from './application/commands/edit-trade-tp/handler';
import { TradeEntity } from '@trade/repository/infrastructure/persistence/trade.entity';
import { TradeRepositoryModule } from '@trade/repository/trade-repository.module';
import { TradeAlertsModule } from '@telegram/notification/trade-alerts/telegram-notification-single.module';
import { TradeListModule } from '@telegram/notification/trade-list/telegram-notification-trade-list.module';
import { PriceCacheModule } from '@price/cache/price-cache.module';
import { PriceExchangeModule } from '@price/exchange/price-exchange.module';
import { LoggerModule } from '@shared';
import { TelegramCoreModule } from '@telegram/core/telegram-core.module';

export const COMMAND_HANDLERS = [
  SendConfirmationHandler,
  ApproveTradeHandler,
  CancelTradeHandler,
  EditTradeFieldHandler,
  EditTradeTPHandler,
];

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([TradeEntity]),
    LoggerModule,
    forwardRef(() => TradeRepositoryModule),
    forwardRef(() => TradeAlertsModule),
    forwardRef(() => TradeListModule),
    forwardRef(() => PriceCacheModule),
    PriceExchangeModule,
    forwardRef(() => TelegramCoreModule),
  ],
  providers: [
    BinanceInfoService,
    TradeApprovalService,
    EditStateManager,
    ...COMMAND_HANDLERS,
  ],
  exports: [BinanceInfoService, TradeApprovalService, EditStateManager],
})
export class TradeApprovalModule {}