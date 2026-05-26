import { Injectable } from '@nestjs/common';
import { Trade, TradeStatus, TradeSide } from '@trade/shared';

/**
 * Formats notification messages for trade events.
 */
@Injectable()
export class NotificationTemplateService {
  formatEntryTriggered(trade: Trade, filledPrice?: number): string {
    const displayPrice = filledPrice ?? trade.entryExecutedPrice ?? trade.entry;
    const typeLabel = trade.side === TradeSide.SPOT
      ? 'SPOT BUY'
      : `FUTURES ${trade.side}`;
    return `🎯 ENTRY HIT <b>${trade.symbol}</b> ${typeLabel} @ <code>${displayPrice}</code>`;
  }

  formatTPHit(trade: Trade, tpIndex: number, rr: number): string {
    const tp = trade.tps?.[tpIndex];
    const typeLabel = trade.side === TradeSide.SPOT
      ? 'SPOT BUY'
      : `FUTURES ${trade.side}`;
    const rrSign = rr >= 0 ? '+' : '';
    return `🚀 TP${tpIndex + 1} HIT <b>${trade.symbol}</b> ${typeLabel} @ <code>${tp}</code> ${rrSign}${rr.toFixed(1)}R`;
  }

  formatSLHit(trade: Trade, rr: number): string {
    const typeLabel = trade.side === TradeSide.SPOT
      ? 'SPOT BUY'
      : `FUTURES ${trade.side}`;
    const rrSign = rr >= 0 ? '+' : '';
    return `❌ SL HIT <b>${trade.symbol}</b> ${typeLabel} @ <code>${trade.sl}</code> ${rrSign}${rr.toFixed(1)}R`;
  }

  formatTradeClosed(trade: Trade, reason: string): string {
    const emoji = trade.status === 'closed_win' ? '💰' : trade.status === 'closed_partial' ? '💵' : trade.status === 'closed_loss' ? '❌' : trade.status === 'cancelled' ? '🚫' : '➖';
    const typeLabel = trade.side === TradeSide.SPOT
      ? 'SPOT BUY'
      : `FUTURES ${trade.side}`;
    return `${emoji} TRADE CLOSED <b>${trade.symbol}</b> ${typeLabel} - ${reason}`;
  }

  formatTradeCreated(trade: Trade): string {
    const emoji = trade.side === TradeSide.LONG ? '🟢' : trade.side === TradeSide.SHORT ? '🔴' : '⚪';
    return `
${emoji} NEW TRADE - ${trade.symbol}

Side: ${trade.side}
Entry: ${trade.entry}
${trade.entryMax ? `Entry Max: ${trade.entryMax}` : ''}
${trade.sl ? `SL: ${trade.sl}` : ''}
${trade.tps ? `TP: ${trade.tps.join(' / ')}` : ''}
${trade.notes ? `Notes: ${trade.notes}` : ''}
    `.trim();
  }

  formatModification(trade: Trade, field: string, oldValue: unknown, newValue: unknown): string {
    const oldStr = typeof oldValue === 'object' ? JSON.stringify(oldValue) : String(oldValue);
    const newStr = typeof newValue === 'object' ? JSON.stringify(newValue) : String(newValue);
    return `
✏️ TRADE MODIFIED - ${trade.symbol}

${field}: ${oldStr} → ${newStr}
    `.trim();
  }

  formatPartialTP(trade: Trade, tpIndex: number, rr: number): string {
    const tp = trade.tps?.[tpIndex];
    const typeLabel = trade.side === TradeSide.SPOT
      ? 'SPOT BUY'
      : `FUTURES ${trade.side}`;
    const rrSign = rr >= 0 ? '+' : '';
    return `💵 PARTIAL TP${tpIndex + 1} HIT <b>${trade.symbol}</b> ${typeLabel} @ <code>${tp}</code> ${rrSign}${rr.toFixed(1)}R`;
  }

  formatBreakeven(trade: Trade): string {
    const typeLabel = trade.side === TradeSide.SPOT
      ? 'SPOT BUY'
      : `FUTURES ${trade.side}`;
    return `🔒 BREAKEVEN <b>${trade.symbol}</b> ${typeLabel} @ <code>${trade.entry}</code>`;
  }

  private getStatusEmoji(status: TradeStatus): string {
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
}