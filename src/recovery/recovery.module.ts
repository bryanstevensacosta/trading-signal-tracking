import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { LoggerModule } from '../shared/shared.module';
import { TriggerDetectorService } from '@trade/trigger/domain/services/trigger-detector.service';
import { RecoveryOrchestratorService } from './domain/services/recovery-orchestrator.service';
import { RunRecoveryHandler } from './application/handlers';
import { TradeRepositoryModule } from '@trade/repository/trade-repository.module';
import { BinanceProviderModule } from '@price/provider/binance/binance.module';
import { TelegramNotificationSharedModule } from '../telegram/notification/shared/telegram-notification-shared.module';

const CommandHandlers = [RunRecoveryHandler];

@Module({
  imports: [
    CqrsModule,
    LoggerModule,
    forwardRef(() => TradeRepositoryModule),
    forwardRef(() => BinanceProviderModule),
    TelegramNotificationSharedModule,
  ],
  providers: [
    TriggerDetectorService,
    RecoveryOrchestratorService,
    ...CommandHandlers,
  ],
  exports: [RecoveryOrchestratorService, TriggerDetectorService],
})
export class RecoveryModule {}