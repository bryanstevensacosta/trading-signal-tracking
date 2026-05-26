/**
 * Trade direction.
 */
export enum TradeSide {
  LONG = 'LONG',
  SHORT = 'SHORT',
  SPOT = 'SPOT',
}

/**
 * Type of price trigger event.
 */
export enum TriggerType {
  ENTRY = 'entry',
  TP = 'tp',
  SL = 'sl',
  BREAKEVEN = 'breakeven',
}

/**
 * Reason why a trade was closed.
 */
export enum CloseReason {
  ALL_TP_HIT = 'all_tp_hit',
  TP_THEN_SL = 'tp_then_sl',
  SL_NO_TP = 'sl_no_tp',
  BREAKEVEN = 'breakeven',
  MANUAL = 'manual',
  CANCELLED = 'cancelled',
}