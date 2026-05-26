import { TradeStatus } from '../types';

/**
 * Valid state transitions for trade lifecycle.
 */
export const VALID_TRANSITIONS: Record<TradeStatus, TradeStatus[]> = {
  [TradeStatus.PENDING]: [
    TradeStatus.ACTIVE,
    TradeStatus.CANCELLED,
  ],
  [TradeStatus.ACTIVE]: [
    TradeStatus.PARTIAL_TP,
    TradeStatus.BREAKEVEN,
    TradeStatus.CLOSED_WIN,
    TradeStatus.CLOSED_LOSS,
    TradeStatus.CLOSED_MANUAL,
  ],
  [TradeStatus.PARTIAL_TP]: [
    TradeStatus.PARTIAL_TP,
    TradeStatus.BREAKEVEN,
    TradeStatus.CLOSED_PARTIAL,
    TradeStatus.CLOSED_LOSS,
    TradeStatus.CLOSED_MANUAL,
  ],
  [TradeStatus.BREAKEVEN]: [
    TradeStatus.CLOSED_BREAKEVEN,
    TradeStatus.CLOSED_MANUAL,
  ],
  [TradeStatus.CLOSED_WIN]: [],
  [TradeStatus.CLOSED_PARTIAL]: [],
  [TradeStatus.CLOSED_LOSS]: [],
  [TradeStatus.CLOSED_BREAKEVEN]: [],
  [TradeStatus.CLOSED_MANUAL]: [],
  [TradeStatus.CANCELLED]: [],
};

/**
 * Checks if a state transition is valid.
 * @param from - Current trade status
 * @param to - Target trade status
 * @returns True if transition is allowed
 */
export function isValidTransition(from: TradeStatus, to: TradeStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}