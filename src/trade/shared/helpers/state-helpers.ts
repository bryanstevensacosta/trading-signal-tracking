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
 * @returns True if status starts with 'closed_' or is CANCELLED
 */
export function isClosedTrade(status: TradeStatus): boolean {
  return status.startsWith('closed_') || status === TradeStatus.CANCELLED;
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

/**
 * Checks if trade status is winning (closed with profit).
 * @param status - Trade status to check
 * @returns True if status is CLOSED_WIN or CLOSED_PARTIAL
 */
export function isWinningTrade(status: TradeStatus): boolean {
  return status === TradeStatus.CLOSED_WIN || status === TradeStatus.CLOSED_PARTIAL;
}

/**
 * Checks if trade status is losing (closed with loss).
 * @param status - Trade status to check
 * @returns True if status is CLOSED_LOSS
 */
export function isLosingTrade(status: TradeStatus): boolean {
  return status === TradeStatus.CLOSED_LOSS;
}

/**
 * All closed trade statuses.
 */
export const CLOSED_STATUSES: TradeStatus[] = [
  TradeStatus.CLOSED_WIN,
  TradeStatus.CLOSED_PARTIAL,
  TradeStatus.CLOSED_LOSS,
  TradeStatus.CLOSED_BREAKEVEN,
  TradeStatus.CLOSED_MANUAL,
];