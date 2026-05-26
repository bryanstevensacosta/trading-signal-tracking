import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BINANCE_INFO_PORT } from './domain/ports/binance-info.port';
import { BinanceInfoAdapter } from './infrastructure/adapters/binance-info.adapter';
import { BinanceInfoService } from './domain/services/binance-info.service';
import { ConfirmationTemplateService } from './domain/services/confirmation-template.service';
import { EditStateManager } from './domain/services/edit-state-manager.service';
import { SendConfirmationHandler } from './application/commands/send-confirmation/handler';
import { ApproveTradeHandler } from './application/commands/approve-trade/handler';
import { CancelTradeHandler } from './application/commands/cancel-trade/handler';
import { EditTradeFieldHandler } from './application/commands/edit-trade-field/handler';
import { EditTradeTPHandler } from './application/commands/edit-trade-tp/handler';
import { TradeEntity } from '@trade/repository/infrastructure/persistence/trade.entity';
import { TradeRepositoryModule } from '@trade/repository/trade-repository.module';
import { TelegramNotificationSingleModule } from '@telegram/notification/single-trade/telegram-notification-single.module';
import { TelegramNotificationTradeListModule } from '@telegram/notification/trade-list/telegram-notification-trade-list.module';
import { PriceCacheModule } from '@price/cache/price-cache.module';
import { LoggerModule } from '@shared';

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
    forwardRef(() => TelegramNotificationSingleModule),
    forwardRef(() => TelegramNotificationTradeListModule),
    forwardRef(() => PriceCacheModule),
  ],
  providers: [
    {
      provide: BINANCE_INFO_PORT,
      useClass: BinanceInfoAdapter,
    },
    BinanceInfoService,
    ConfirmationTemplateService,
    EditStateManager,
    ...COMMAND_HANDLERS,
  ],
  exports: [BinanceInfoService, ConfirmationTemplateService, EditStateManager],
})
export class TradeConfirmationModule {}