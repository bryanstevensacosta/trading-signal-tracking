import { TradeStatus } from '@trade/shared';

/**
 * Returns emoji for trade status.
 * 
 * @param status - Trade status
 * @returns Emoji representation
 * 
 * @example
 * formatStatusEmoji('active') // '✅'
 * formatStatusEmoji('closed_win') // '💰'
 */
export function formatStatusEmoji(status: TradeStatus): string {
  const emojiMap: Record<TradeStatus, string> = {
    pending: '⏳',
    active: '✅',
    partial_tp: '🎯',
    breakeven: '⚖️',
    closed_win: '💰',
    closed_partial: '💵',
    closed_loss: '❌',
    closed_breakeven: '➖',
    closed_manual: '✋',
    cancelled: '🚫',
  };
  return emojiMap[status] || '📊';
}

/**
 * Returns text for trade status.
 * 
 * @param status - Trade status
 * @returns Text representation
 * 
 * @example
 * formatStatusText('active') // 'ACTIVE'
 * formatStatusText('closed_win') // 'WIN'
 */
export function formatStatusText(status: TradeStatus): string {
  const textMap: Record<TradeStatus, string> = {
    pending: 'PENDING',
    active: 'ACTIVE',
    partial_tp: 'PARTIAL',
    breakeven: 'BE',
    closed_win: 'WIN',
    closed_partial: 'PARTIAL',
    closed_loss: 'LOSS',
    closed_breakeven: 'BE',
    closed_manual: 'CLOSED',
    cancelled: 'CANCELLED',
  };
  return textMap[status] || status;
}

/**
 * Returns full text for trade status (with spaces).
 * 
 * @param status - Trade status
 * @returns Full text representation
 * 
 * @example
 * formatStatusFull('active') // '✅ Active'
 * formatStatusFull('closed_win') // '💰 Won'
 */
export function formatStatusFull(status: TradeStatus): string {
  const statusMap: Record<TradeStatus, string> = {
    pending: '⏳ Pending',
    active: '✅ Active',
    partial_tp: '🎯 Partial TP',
    breakeven: '⚖️ Breakeven',
    closed_win: '💰 Won',
    closed_partial: '💵 Partial',
    closed_loss: '❌ Lost',
    closed_breakeven: '➖ BE',
    closed_manual: '✋ Closed',
    cancelled: '🚫 Cancelled',
  };
  return statusMap[status] || status;
}