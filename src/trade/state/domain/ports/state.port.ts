import { Trade, TradeStatus } from '../../../shared/types';
import { TransitionResult } from '../services/state-machine.service';

/**
 * Port interface for state operations.
 * Defines the contract for state transitions in the trade lifecycle.
 * 
 * @interface StatePort
 * 
 * @example
 * const statePort: StatePort = new TradeStateAdapter();
 * const result = await statePort.transition(trade, TradeStatus.ACTIVE, 'entry_triggered');
 */
export interface StatePort {
  /**
   * Transitions a trade to a new status.
   * 
   * @param trade - The trade to transition
   * @param targetStatus - The target status
   * @param reason - Optional reason for the transition
   * @returns TransitionResult with success status and any error
   */
  transition(
    trade: Trade,
    targetStatus: TradeStatus,
    reason?: string,
  ): Promise<TransitionResult>;

  /**
   * Activates a pending trade when entry price is hit.
   * 
   * @param trade - The trade to activate
   * @returns TransitionResult
   */
  activate(trade: Trade): Promise<TransitionResult>;

  /**
   * Closes a trade with all TPs hit.
   * 
   * @param trade - The trade to close
   * @returns TransitionResult
   */
  closeWithTP(trade: Trade): Promise<TransitionResult>;

  /**
   * Closes a trade with SL hit (no TP hit).
   * 
   * @param trade - The trade to close
   * @returns TransitionResult
   */
  closeWithSL(trade: Trade): Promise<TransitionResult>;

  /**
   * Manually closes a trade by user request.
   * 
   * @param trade - The trade to close
   * @returns TransitionResult
   */
  closeManual(trade: Trade): Promise<TransitionResult>;

  /**
   * Cancels a pending trade.
   * 
   * @param trade - The trade to cancel
   * @returns TransitionResult
   */
  cancel(trade: Trade): Promise<TransitionResult>;

  /**
   * Moves SL to entry price (breakeven).
   * 
   * @param trade - The trade to move to breakeven
   * @returns TransitionResult
   */
  moveToBreakeven(trade: Trade): Promise<TransitionResult>;
}