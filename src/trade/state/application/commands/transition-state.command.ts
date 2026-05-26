import { ICommand } from '@nestjs/cqrs';
import { TradeStatus } from '../../../shared/types';

/**
 * Command to transition a trade to a new state.
 * Validates the transition before executing.
 * 
 * @class TransitionStateCommand
 * @implements ICommand
 * 
 * @example
 * const command = new TransitionStateCommand('uuid-here', TradeStatus.ACTIVE, 'entry_triggered');
 */
export class TransitionStateCommand implements ICommand {
  constructor(
    public readonly tradeId: string,
    public readonly targetStatus: TradeStatus,
    public readonly reason?: string,
    public readonly metadata?: {
      tpsHit?: number[];
      closedAt?: Date;
    },
  ) {}
}