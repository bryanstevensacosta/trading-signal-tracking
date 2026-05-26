import { TradeStatus } from '../types';

/**
 * Checks if trade status is active (not closed).
 * @param status - Trade status to check
 * @returns True if status is PENDING, ACTIVE, PARTIAL_TP, or BREAKEVEN
 */
export function isActiveTrade(status: TradeStatus): boolean {
  return [
    TradeStatus.PENDING,
    TradeStatus.ACTIVE,
    TradeStatus.PARTIAL_TP,
    TradeStatus.BREAKEVEN,
  ].includes(status);
}

/**
 * Checks if trade status is closed (terminal).
 * @param status - Trade status to check
 * @returns True if status starts with 'closed_'
 */
export function isClosedTrade(status: TradeStatus): boolean {
  return status.startsWith('closed_');
}

/**
 * Checks if trade is in pending state.
 * @param status - Trade status to check
 * @returns True if status is PENDING
 */
export function isPendingTrade(status: TradeStatus): boolean {
  return status === TradeStatus.PENDING;
}

/**
 * Checks if entry can be modified.
 * @param status - Current trade status
 * @returns True only for PENDING trades
 */
export function canModifyEntry(status: TradeStatus): boolean {
  return status === TradeStatus.PENDING;
}

/**
 * Checks if stop loss can be modified.
 * @param status - Current trade status
 * @returns True for active trades
 */
export function canModifySL(status: TradeStatus): boolean {
  return isActiveTrade(status);
}

/**
 * Checks if take profits can be modified.
 * @param status - Current trade status
 * @returns True for active trades
 */
export function canModifyTP(status: TradeStatus): boolean {
  return isActiveTrade(status);
}

/**
 * Checks if trade can be manually closed.
 * @param status - Current trade status
 * @returns True for ACTIVE, PARTIAL_TP, or BREAKEVEN trades
 */
export function canManualClose(status: TradeStatus): boolean {
  return [
    TradeStatus.ACTIVE,
    TradeStatus.PARTIAL_TP,
    TradeStatus.BREAKEVEN,
  ].includes(status);
}

/**
 * Checks if trade can be cancelled.
 * @param status - Current trade status
 * @returns True only for PENDING trades
 */
export function canCancel(status: TradeStatus): boolean {
  return status === TradeStatus.PENDING;
}

/**
 * Checks if trade can be moved to breakeven.
 * @param status - Current trade status
 * @returns True for ACTIVE or PARTIAL_TP trades
 */
export function canMoveToBreakeven(status: TradeStatus): boolean {
  return status === TradeStatus.ACTIVE || status === TradeStatus.PARTIAL_TP;
}