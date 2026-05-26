import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { LoggerModule } from '../../shared/shared.module';
import { StateMachineService } from './domain/services/state-machine.service';
import { TransitionStateHandler } from './application/commands/transition-state.handler';
import { TradeRepositoryModule } from '../repository/trade-repository.module';

export const CommandHandlers = [TransitionStateHandler];

/**
 * Trade State Module
 * 
 * Responsible for managing trade state transitions.
 * Validates transitions using VALID_TRANSITIONS map and emits StateChangedEvent.
 * 
 * @module TradeStateModule
 * 
 * @example
 * @Module({
 *   imports: [TradeStateModule],
 * })
 * export class AppModule {}
 * 
 * **What trade/state does:**
 * - State transitions (PENDING → ACTIVE, ACTIVE → CLOSED_WIN, etc.)
 * - Validates transitions using VALID_TRANSITIONS map
 * - Emits StateChangedEvent
 * 
 * **What trade/state does NOT do:**
 * - Trigger detection (that goes to trade/engine)
 * - Entry/SL/TP modifications (that goes to telegram/command)
 * - Price monitoring (that goes to trade/engine)
 * 
 * @TODO When telegram/notification/single-trade is implemented:
 *       - Subscribe to StateChangedEvent in notification module
 *       - Send formatted Telegram messages on each transition
 *       - Include trade details, PnL, and reason in notifications
 */
@Module({
  imports: [
    CqrsModule,
    LoggerModule,
    forwardRef(() => TradeRepositoryModule),
  ],
  providers: [
    StateMachineService,
    ...CommandHandlers,
  ],
  exports: [StateMachineService, TransitionStateHandler],
})
export class TradeStateModule {}