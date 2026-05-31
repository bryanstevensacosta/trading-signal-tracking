import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TransitionStateCommand } from './transition-state.command';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '../../../repository/domain/ports/trade-repository.port';
import { StateMachineService } from '../../domain/services/state-machine.service';
import { StateChangedEvent } from '../../domain/events/state-changed.event';
import { Trade, TradeStatus } from '../../../shared/types';
import { InvalidTransitionError, TradeNotFoundError } from '../../domain/errors/state-errors';
import { LoggerPort, LOGGER_PORT } from '../../../../shared/domain/ports/logger.port';

/**
 * Handler for TransitionStateCommand.
 * Validates state transitions and updates trade in repository.
 *
 * @class TransitionStateHandler
 * @implements ICommandHandler<TransitionStateCommand>
 *
 * @example
 * await commandBus.execute(new TransitionStateCommand('uuid', TradeStatus.ACTIVE, 'entry'));
 *
 * @TODO When trade/engine is implemented:
 *       - trade/engine will call this handler when entry/SL/TP is hit
 *       - Subscribe to price/stream and detect triggers
 *       - Call TransitionStateCommand for each trigger detected
 *
 * @TODO When telegram/notification/single-trade is implemented:
 *       - Listen to StateChangedEvent and send Telegram notifications
 *       - Format message based on oldStatus → newStatus transition
 *       - Use reason field to customize notification text
 */
@CommandHandler(TransitionStateCommand)
export class TransitionStateHandler
  implements ICommandHandler<TransitionStateCommand>
{
  private readonly logger: LoggerPort;

  constructor(
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    private readonly stateMachine: StateMachineService,
    private readonly eventBus: EventBus,
    @Inject(LOGGER_PORT) logger: LoggerPort,
  ) {
    this.logger = logger;
  }

  /**
   * Executes the state transition command.
   * @param command - The transition state command
   * @returns Updated trade
   * @throws TradeNotFoundError if trade not found
   * @throws InvalidTransitionError if transition is invalid
   */
  async execute(command: TransitionStateCommand): Promise<Trade> {
    this.logger.info(`[TransitionStateHandler] Executing command for trade: ${command.tradeId} -> ${command.targetStatus}, reason: ${command.reason}`);
    const trade = await this.repository.findById(command.tradeId);
    
    if (!trade) {
      this.logger.error(`[TransitionStateHandler] Trade ${command.tradeId} NOT FOUND`);
      throw new TradeNotFoundError(command.tradeId);
    }

    this.logger.debug(`[TransitionStateHandler] ${command.tradeId}: Current status: ${trade.status}`);

    const result = this.stateMachine.transition(
      trade,
      command.targetStatus,
      command.reason,
    );

    if (!result.success) {
      this.logger.error(`[TransitionStateHandler] ${command.tradeId}: Transition FAILED from ${trade.status} to ${command.targetStatus}, error: ${result.error}`);
      throw new InvalidTransitionError(trade.status, command.targetStatus);
    }
    
    this.logger.info(`[TransitionStateHandler] ${command.tradeId}: Transition VALIDATED ${trade.status} -> ${command.targetStatus}`);

    const isClosed = command.targetStatus.startsWith('closed_') || command.targetStatus === TradeStatus.CANCELLED;
    
    const updateData: Record<string, unknown> = {
      status: command.targetStatus,
      closedAt: isClosed ? new Date() : undefined,
    };

    if (command.metadata?.tpsHit) {
      updateData.tpsHit = command.metadata.tpsHit;
    }
    
    await this.repository.update(command.tradeId, updateData);

    const updatedTrade = await this.repository.findById(command.tradeId);
    
    if (!updatedTrade) {
      throw new TradeNotFoundError(command.tradeId);
    }

    await this.eventBus.publish(
      new StateChangedEvent(
        updatedTrade,
        trade.status,
        command.targetStatus,
        command.reason || 'state_transition',
        command.metadata?.rr,
      ),
    );

    this.logger.info(
      `Trade ${command.tradeId} transitioned from ${trade.status} to ${command.targetStatus}`,
    );

    return updatedTrade;
  }
}
