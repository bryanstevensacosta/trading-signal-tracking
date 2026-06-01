export const TELEGRAM_LABELS = {
  trades: '📊',
  direction: {
    LONG: '',
    SHORT: '',
    SPOT: '',
  },
  fields: {
    entry: 'ENTRY',
    sl: 'SL',
    tp: 'TP',
    status: 'STATUS',
    rr: 'RR',
  },
  separators: {
    price: '|',
    trade: '\n\n',
  },
} as const;

export const TRADE_STATUS_HISTORY = {
  active: 'ACTIVE',
  partial_tp: 'ACTIVE',
  breakeven: 'ACTIVE',
  closed_win: 'CLOSED AT TP',
  closed_partial: 'CLOSED AT TP',
  closed_loss: 'CLOSED AT SL',
  closed_breakeven: 'CLOSED AT BE',
  closed_manual: 'CLOSED MANUAL',
  pending: 'PENDING',
  cancelled: 'CANCELLED',
} as const;

export type TradeStatusHistoryKey = keyof typeof TRADE_STATUS_HISTORY;