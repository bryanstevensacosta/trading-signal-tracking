import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { LoggerModule } from '../../shared/shared.module';
import { TriggerOrchestratorService } from './domain/services/trigger-orchestrator.service';
import { TriggerDetectorService } from './domain/services/trigger-detector.service';
import { OnPriceUpdatedHandler } from './application/event-handlers/on-price-updated.handler';
import { OnTriggerDetectedHandler } from './application/event-handlers/on-trigger-detected.handler';
import { StartMonitoringHandler } from './application/commands/start-monitoring/handler';
import { StopMonitoringHandler } from './application/commands/stop-monitoring/handler';
import { CheckMissedTriggersHandler } from './application/commands/check-missed-triggers/handler';
import { TradeRepositoryModule } from '../repository/trade-repository.module';
import { TradeStateModule } from '../state/trade-state.module';
import { PriceStreamModule } from '@price/stream/price-stream.module';
import { BinanceProviderModule } from '@price/provider/binance/binance.module';
import { TelegramNotificationSharedModule } from '../../telegram/notification/shared/telegram-notification-shared.module';
import { RecoveryModule } from '@recovery/recovery.module';

export const CommandHandlers = [
  StartMonitoringHandler,
  StopMonitoringHandler,
  CheckMissedTriggersHandler,
];
export const EventHandlers = [OnPriceUpdatedHandler, OnTriggerDetectedHandler];

const Services = [TriggerOrchestratorService, TriggerDetectorService];

/**
 * Trade Trigger Module.
 * Monitors prices and detects triggers (entry, TP, SL) for trades.
 *
 * @example
 * @Module({
 *   imports: [TriggerModule],
 * })
 * export class AppModule {}
 *
 * **What trade/trigger does:**
 * - Subscribe to symbols for active/pending trades
 * - Detect entry, TP, SL hits via TriggerDetectorService
 * - Emit TriggerDetectedEvent when trigger is hit
 * - Handle state transitions via trade/state
 * - Recover missed triggers on startup
 *
 * **What trade/trigger does NOT do:**
 * - State transitions (that goes to trade/state)
 * - Send notifications (that goes to telegram/notification)
 * - Handle modifications (that goes to telegram/command)
 */
@Module({
  imports: [
    CqrsModule,
    LoggerModule,
    forwardRef(() => TradeRepositoryModule),
    forwardRef(() => TradeStateModule),
    forwardRef(() => PriceStreamModule),
    forwardRef(() => BinanceProviderModule),
    TelegramNotificationSharedModule,
    RecoveryModule,
  ],
  providers: [
    ...Services,
    ...CommandHandlers,
    ...EventHandlers,
  ],
  exports: [TriggerOrchestratorService, TriggerDetectorService],
})
export class TriggerModule {}