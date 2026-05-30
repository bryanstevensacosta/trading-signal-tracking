import { Injectable } from '@nestjs/common';
import { Trade } from '@trade/shared';
import { formatSideEmoji, formatStatusEmoji, formatTypeLabel } from '@telegram/shared/helpers';

/**
 * Formats notification messages for trade events.
 */
@Injectable()
export class TradeAlertService {
  formatEntryTriggered(trade: Trade, filledPrice?: number): string {
    const displayPrice = filledPrice ?? trade.entryExecutedPrice ?? trade.entry;
    return `🎯 ENTRY HIT <b>${trade.symbol}</b> ${formatTypeLabel(trade.side)} @ <code>${displayPrice}</code>`;
  }

  formatTPHit(trade: Trade, tpIndex: number, rr: number): string {
    const tp = trade.tps?.[tpIndex];
    const rrSign = rr >= 0 ? '+' : '';
    return `🚀 TP${tpIndex + 1} HIT <b>${trade.symbol}</b> ${formatTypeLabel(trade.side)} @ <code>${tp}</code> ${rrSign}${rr.toFixed(1)}R`;
  }

  formatSLHit(trade: Trade, rr: number): string {
    const rrSign = rr >= 0 ? '+' : '';
    return `❌ SL HIT <b>${trade.symbol}</b> ${formatTypeLabel(trade.side)} @ <code>${trade.sl}</code> ${rrSign}${rr.toFixed(1)}R`;
  }

  formatSLTriggered(trade: Trade): string {
    return `❌ STOP-LOSS HIT <b>${trade.symbol}</b> ${trade.side} @ <code>${trade.sl}</code> -1R`;
  }

  formatTradeClosed(trade: Trade, reason: string): string {
    const emoji = formatStatusEmoji(trade.status);
    return `${emoji} TRADE CLOSED <b>${trade.symbol}</b> ${formatTypeLabel(trade.side)} - ${reason}`;
  }

  formatTradeCreated(trade: Trade): string {
    const emoji = formatSideEmoji(trade.side);
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
    const rrSign = rr >= 0 ? '+' : '';
    return `💵 PARTIAL TP${tpIndex + 1} HIT <b>${trade.symbol}</b> ${formatTypeLabel(trade.side)} @ <code>${tp}</code> ${rrSign}${rr.toFixed(1)}R`;
  }

  formatBreakeven(trade: Trade): string {
    return `🔒 BREAKEVEN <b>${trade.symbol}</b> ${formatTypeLabel(trade.side)} @ <code>${trade.entry}</code>`;
  }
}