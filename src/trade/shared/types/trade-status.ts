/**
 * Trade lifecycle states.
 */
export enum TradeStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  PARTIAL_TP = 'partial_tp',
  BREAKEVEN = 'breakeven',
  CLOSED_WIN = 'closed_win',
  CLOSED_PARTIAL = 'closed_partial',
  CLOSED_LOSS = 'closed_loss',
  CLOSED_BREAKEVEN = 'closed_breakeven',
  CLOSED_MANUAL = 'closed_manual',
  CANCELLED = 'cancelled',
}

/**
 * Trade statuses that represent a closed trade (terminal state).
 * @see {@link TradeStatus}
 */
export type ClosedTradeStatus =
  | TradeStatus.CLOSED_WIN
  | TradeStatus.CLOSED_PARTIAL
  | TradeStatus.CLOSED_LOSS
  | TradeStatus.CLOSED_BREAKEVEN
  | TradeStatus.CLOSED_MANUAL;

/**
 * Trade statuses that represent an active trade (not yet closed).
 * @see {@link TradeStatus}
 */
export type ActiveTradeStatus =
  | TradeStatus.PENDING
  | TradeStatus.ACTIVE
  | TradeStatus.PARTIAL_TP
  | TradeStatus.BREAKEVEN;