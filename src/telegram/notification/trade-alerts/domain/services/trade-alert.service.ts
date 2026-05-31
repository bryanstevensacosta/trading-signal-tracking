import { Injectable } from '@nestjs/common';
import { Trade, TradeSide } from '@trade/shared';
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

  formatTPHit(trade: Trade, tpIndex: number, rr?: number): string {
    const tp = trade.tps?.[tpIndex];
    const totalTps = trade.tps?.length ?? 0;
    const rrDisplay = rr != null ? `${rr >= 0 ? '+' : ''}${rr.toFixed(1)}R` : '';
    
    if (totalTps === 1 && tpIndex === 0) {
      return `🚀 ALL TP HIT <b>${trade.symbol}</b> ${formatTypeLabel(trade.side)} @ <code>${tp}</code> ${rrDisplay}`;
    }
    
    return `🚀 TP${tpIndex + 1} HIT <b>${trade.symbol}</b> ${formatTypeLabel(trade.side)} @ <code>${tp}</code> ${rrDisplay}`;
  }

  formatSLHit(trade: Trade, rr: number): string {
    const rrSign = rr >= 0 ? '+' : '';
    return `❌ SL HIT <b>${trade.symbol}</b> ${formatTypeLabel(trade.side)} @ <code>${trade.sl}</code> ${rrSign}${rr.toFixed(1)}R`;
  }

  formatSLTriggered(trade: Trade): string {
    return `❌ SL HIT <b>${trade.symbol}</b> ${trade.side} @ <code>${trade.sl}</code> -1R`;
  }

  formatTradeClosed(trade: Trade, reason: string): string {
    const emoji = formatStatusEmoji(trade.status);
    return `${emoji} TRADE CLOSED <b>${trade.symbol}</b> ${formatTypeLabel(trade.side)} - ${reason}`;
  }

  formatTradeCreated(trade: Trade): string {
    const emoji = formatSideEmoji(trade.side);
    const sideLabel = trade.side === TradeSide.LONG ? 'LONG' : trade.side === TradeSide.SHORT ? 'SHORT' : 'SPOT';
    
    const lines = [
      `➕ NEW TRADE`,
      `🪙 ${trade.symbol}`,
      `${emoji} ${sideLabel}`,
      `✨ ENTRY: <code>${trade.entry}</code>`,
    ];

    if (trade.sl) lines.push(`🚫 SL: <code>${trade.sl}</code>`);

    if (trade.tps && trade.tps.length > 0) {
      lines.push(`🚀 TP: <code>${trade.tps.join(' / ')}</code>`);
    }

    if (trade.chartUrl) {
      lines.push(`📊 CHART: ${trade.chartUrl}`);
    }

    return lines.join('\n');
  }

  formatTradeCreatedInstantActive(trade: Trade, _executedPrice: number): string {
    const emoji = formatSideEmoji(trade.side);
    const sideLabel = trade.side === TradeSide.LONG ? 'LONG' : trade.side === TradeSide.SHORT ? 'SHORT' : 'SPOT';
    
    const lines = [
      `➕ NEW TRADE`,
      `🪙 ${trade.symbol}`,
      `${emoji} ${sideLabel}`,
      `⭐️ OPEN AT ACTUAL PRICE`,
      `✨ MAX ENTRY: <code>${trade.entry}</code>`,
    ];

    if (trade.sl) lines.push(`🚫 SL: <code>${trade.sl}</code>`);

    if (trade.tps && trade.tps.length > 0) {
      lines.push(`🚀 TP: <code>${trade.tps.join(' / ')}</code>`);
    }

    if (trade.chartUrl) {
      lines.push(`📊 CHART: ${trade.chartUrl}`);
    }

    return lines.join('\n');
  }

  formatEntryHitInstant(trade: Trade, executedPrice: number): string {
    const sideLabel = trade.side === TradeSide.LONG ? '🟢 LONG' : trade.side === TradeSide.SHORT ? '🔴 SHORT' : '🔵 SPOT';

    return `🎯 ENTRY HIT 
📊 <b>${trade.symbol}</b>
${sideLabel}
⭐️ ACTIVE 
📍 ENTRY AVG @ <code>${executedPrice}</code>`;
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

  formatEntryExecuted(trade: Trade): string {
    const planned = trade.entry;
    const executed = trade.entryExecutedPrice;
    const sideLabel = trade.side === TradeSide.LONG ? 'LONG' : 'SHORT';
    
    if (!executed || executed === planned) {
      return `🎯 ENTRY HIT <b>${trade.symbol}</b> ${sideLabel} @ <code>${executed || planned}</code>`;
    }

    const diff = executed - planned;
    const diffPercent = ((diff / planned) * 100).toFixed(2);
    const diffSign = diff >= 0 ? '+' : '';
    const betterPrice = (trade.side === TradeSide.LONG && diff < 0) || (trade.side === TradeSide.SHORT && diff > 0);

    return `🎯 ENTRY HIT <b>${trade.symbol}</b> ${sideLabel}
Planned: <code>${planned}</code> → Executed: <code>${executed}</code>
${diffSign}${diff} (${diffSign}${diffPercent}%) ${betterPrice ? '✅ Better price' : '⚠️ Worse price'}`;
  }
}