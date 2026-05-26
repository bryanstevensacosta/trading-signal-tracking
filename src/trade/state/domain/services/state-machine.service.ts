import { Injectable } from '@nestjs/common';
import { Trade, TradeStatus } from '../../../shared/types';
import { isValidTransition } from '../../../shared/constants';

/**
 * Result of a state transition attempt.
 * 
 * @interface TransitionResult
 * @property success - Whether the transition was successful
 * @property newStatus - The new status if successful
 * @property error - Error message if transition failed
 */
export interface TransitionResult {
  success: boolean;
  newStatus?: TradeStatus;
  error?: string;
}

/**
 * Domain service that manages trade state transitions.
 * Validates transitions using VALID_TRANSITIONS map and executes valid ones.
 * 
 * @class StateMachineService
 * @description Handles state machine logic for trade lifecycle
 * 
 * @example
 * const result = stateMachineService.transition(trade, TradeStatus.ACTIVE, 'entry_triggered');
 * if (result.success) {
 *   console.log('Trade activated');
 * }
 * 
 * @TODO When trade/engine is implemented:
 *       - TradeEngine will use this service to validate transitions
 *       - Before calling TransitionStateCommand, engine will call canTransition()
 *       - The service is stateless so multiple engine instances can use it
 */
@Injectable()
export class StateMachineService {
  /**
   * Checks if a transition from current status to target is valid.
   * 
   * @param trade - The trade to check
   * @param targetStatus - The target status
   * @returns True if transition is allowed
   * 
   * @example
   * const canActivate = stateMachineService.canTransition(trade, TradeStatus.ACTIVE);
   */
  canTransition(trade: Trade, targetStatus: TradeStatus): boolean {
    return isValidTransition(trade.status, targetStatus);
  }

  /**
   * Transitions a trade to a new status.
   * Validates the transition before executing.
   * 
   * @param trade - The trade to transition
   * @param targetStatus - The target status
   * @param reason - Optional reason for the transition
   * @returns TransitionResult with success or error
   * 
   * @example
   * const result = stateMachineService.transition(trade, TradeStatus.ACTIVE, 'entry_triggered');
   */
  transition(
    trade: Trade,
    targetStatus: TradeStatus,
    _reason?: string,
  ): TransitionResult {
    if (!this.canTransition(trade, targetStatus)) {
      return {
        success: false,
        error: `Invalid transition from ${trade.status} to ${targetStatus}`,
      };
    }

    return {
      success: true,
      newStatus: targetStatus,
    };
  }

  /**
   * Activates a pending trade (entry price hit).
   * 
   * @param trade - The trade to activate
   * @returns TransitionResult
   * 
   * @example
   * const result = stateMachineService.activate(trade);
   */
  activate(trade: Trade): TransitionResult {
    return this.transition(trade, TradeStatus.ACTIVE, 'entry_triggered');
  }

  /**
   * Closes a trade as winning (all TPs hit).
   * 
   * @param trade - The trade to close
   * @returns TransitionResult
   * 
   * @example
   * const result = stateMachineService.closeWithTP(trade);
   */
  closeWithTP(trade: Trade): TransitionResult {
    return this.transition(trade, TradeStatus.CLOSED_WIN, 'all_tp_hit');
  }

  /**
   * Closes a trade as losing (SL hit, no TP).
   * 
   * @param trade - The trade to close
   * @returns TransitionResult
   * 
   * @example
   * const result = stateMachineService.closeWithSL(trade);
   */
  closeWithSL(trade: Trade): TransitionResult {
    return this.transition(trade, TradeStatus.CLOSED_LOSS, 'sl_triggered');
  }

  /**
   * Manually closes a trade (user request).
   * 
   * @param trade - The trade to close
   * @returns TransitionResult
   * 
   * @example
   * const result = stateMachineService.closeManual(trade);
   */
  closeManual(trade: Trade): TransitionResult {
    return this.transition(trade, TradeStatus.CLOSED_MANUAL, 'manual_close');
  }

  /**
   * Cancels a pending trade.
   * 
   * @param trade - The trade to cancel
   * @returns TransitionResult
   * 
   * @example
   * const result = stateMachineService.cancel(trade);
   */
  cancel(trade: Trade): TransitionResult {
    return this.transition(trade, TradeStatus.CANCELLED, 'cancelled');
  }

  /**
   * Moves SL to entry price (breakeven).
   * 
   * @param trade - The trade to move to breakeven
   * @returns TransitionResult
   * 
   * @example
   * const result = stateMachineService.moveToBreakeven(trade);
   */
  moveToBreakeven(trade: Trade): TransitionResult {
    return this.transition(trade, TradeStatus.BREAKEVEN, 'moved_to_breakeven');
  }

  /**
   * Marks a trade as having partial TPs hit.
   * 
   * @param trade - The trade to update
   * @returns TransitionResult
   * 
   * @example
   * const result = stateMachineService.partialTP(trade);
   */
  partialTP(trade: Trade): TransitionResult {
    return this.transition(trade, TradeStatus.PARTIAL_TP, 'partial_tp_hit');
  }

  /**
   * Closes a trade after partial TP was hit and then SL hit.
   * 
   * @param trade - The trade to close
   * @returns TransitionResult
   * 
   * @example
   * const result = stateMachineService.closePartial(trade);
   */
  closePartial(trade: Trade): TransitionResult {
    return this.transition(trade, TradeStatus.CLOSED_PARTIAL, 'partial_closed');
  }

  /**
   * Closes a trade at breakeven.
   * 
   * @param trade - The trade to close
   * @returns TransitionResult
   * 
   * @example
   * const result = stateMachineService.closeBreakeven(trade);
   */
  closeBreakeven(trade: Trade): TransitionResult {
    return this.transition(trade, TradeStatus.CLOSED_BREAKEVEN, 'breakeven_hit');
  }
}