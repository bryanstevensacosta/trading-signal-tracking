import { Injectable } from '@nestjs/common';
import { Trade, TradeStatus } from '@trade/shared';
import { formatTps } from '@telegram/shared/helpers';

export interface TradeDetailResult {
  text: string;
  buttons: InlineButton[][];
  canCancel: boolean;
  canClose: boolean;
  canEditEntry: boolean;
  canEditSL: boolean;
  canEditTP: boolean;
}

interface InlineButton {
  text: string;
  callback_data: string;
}

@Injectable()
export class TradeDetailFormatter {
  formatDetail(trade: Trade, currentPrice?: number): TradeDetailResult {
    const statusEmoji = this.getStatusEmoji(trade.status);
    const statusText = this.getStatusText(trade.status);

    const entry = trade.entryExecutedPrice || trade.entry;
    const sl = trade.sl || 'N/A';
    const tpsText = trade.tps && trade.tps.length > 0 ? formatTps(trade.tps, trade.tpsHit) : 'N/A';

    let currentPriceText = '';
    let pnlText = '';
    if (currentPrice !== undefined && trade.entryExecutedPrice) {
      currentPriceText = `\n<b>CURRENT:</b> <code>${currentPrice}</code>`;
      const pnl = trade.side === 'LONG'
        ? ((currentPrice - trade.entryExecutedPrice) / trade.entryExecutedPrice) * 100
        : ((trade.entryExecutedPrice - currentPrice) / trade.entryExecutedPrice) * 100;
      pnlText = ` (${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%)`;
    }

    const text = `
${statusEmoji} ${trade.side} ${trade.symbol} | ${statusText}

<b>ENTRY:</b> <code>${entry}</code>${trade.entryMax ? ` - <code>${trade.entryMax}</code>` : ''}${currentPriceText}${pnlText}
<b>SL:</b> <code>${sl}</code>
<b>TP:</b> <code>${tpsText}</code>
${trade.notes ? `\n<b>NOTES:</b> ${trade.notes}` : ''}
    `.trim();

    const buttons: InlineButton[][] = [];
    const row1: InlineButton[] = [];
    const row2: InlineButton[] = [];
    const row3: InlineButton[] = [];

    const canCancel = trade.status === TradeStatus.PENDING;
    const canClose = trade.status === TradeStatus.ACTIVE || trade.status === TradeStatus.PARTIAL_TP;
    const canEditEntry = trade.status === TradeStatus.PENDING;
    const canEditSL = trade.status === TradeStatus.ACTIVE || trade.status === TradeStatus.PARTIAL_TP;
    const canEditTP = this.canEditTP(trade);

    if (canCancel) {
      row1.push({ text: '❌ Cancel', callback_data: `sel_cancel:${trade.id}` });
    }
    if (canClose) {
      row1.push({ text: '🔴 Close', callback_data: `sel_close:${trade.id}` });
    }

    if (canEditSL) {
      row2.push({ text: '✏️ Edit SL', callback_data: `sel_edit:${trade.id}:sl` });
    }
    if (canEditTP) {
      row2.push({ text: '✏️ Edit TP', callback_data: `sel_edit:${trade.id}:tp` });
    }

    if (canEditEntry) {
      row3.push({ text: '📍 Edit Entry', callback_data: `sel_edit:${trade.id}:entry` });
    }

    if (row1.length > 0) buttons.push(row1);
    if (row2.length > 0) buttons.push(row2);
    if (row3.length > 0) buttons.push(row3);

    return {
      text,
      buttons,
      canCancel,
      canClose,
      canEditEntry,
      canEditSL,
      canEditTP,
    };
  }

  formatEditPrompt(trade: Trade, field: string): string {
    return `✏️ Editing ${field.toUpperCase()} for ${trade.symbol}\n\nCurrent ${field}: <code>${this.getFieldValue(trade, field)}</code>\n\nSend new value:`;
  }

  formatConfirmation(action: string, trade: Trade): { text: string; buttons: InlineButton[][] } {
    const emoji = action === 'cancel' ? '❌' : '🔴';
    const text = `${emoji} Confirm ${action.charAt(0).toUpperCase() + action.slice(1)}\n\n${action === 'cancel' ? 'Cancel' : 'Close'} ${trade.symbol} trade?\n\nThis action cannot be undone.`;
    const buttons: InlineButton[][] = [
      [
        { text: '✅ Confirm', callback_data: `sel_confirm:${action}:${trade.id}` },
        { text: '❌ Cancel', callback_data: `sel_back:${trade.id}` },
      ],
    ];
    return { text, buttons };
  }

  private getStatusEmoji(status: TradeStatus): string {
    switch (status) {
      case TradeStatus.PENDING:
        return '⏳';
      case TradeStatus.ACTIVE:
        return '🟢';
      case TradeStatus.PARTIAL_TP:
        return '🎯';
      case TradeStatus.CLOSED_WIN:
        return '✅';
      case TradeStatus.CLOSED_LOSS:
        return '❌';
      default:
        return '📊';
    }
  }

  private getStatusText(status: TradeStatus): string {
    switch (status) {
      case TradeStatus.PENDING:
        return 'PENDING';
      case TradeStatus.ACTIVE:
        return 'ACTIVE';
      case TradeStatus.PARTIAL_TP:
        return 'PARTIAL_TP';
      case TradeStatus.CLOSED_WIN:
        return 'CLOSED_WIN';
      case TradeStatus.CLOSED_LOSS:
        return 'CLOSED_LOSS';
      case TradeStatus.CANCELLED:
        return 'CANCELLED';
      default:
        return status;
    }
  }

  private getFieldValue(trade: Trade, field: string): string {
    switch (field) {
      case 'entry':
        return String(trade.entryExecutedPrice || trade.entry);
      case 'sl':
        return trade.sl ? String(trade.sl) : 'N/A';
      case 'tp':
        return trade.tps && trade.tps.length > 0 ? trade.tps.join(' / ') : 'N/A';
      default:
        return 'N/A';
    }
  }

  private canEditTP(trade: Trade): boolean {
    if (trade.status !== TradeStatus.ACTIVE && trade.status !== TradeStatus.PARTIAL_TP) {
      return false;
    }
    if (!trade.tps || trade.tps.length === 0) {
      return false;
    }
    if (trade.tpsHit && trade.tpsHit.length > 0) {
      return false;
    }
    return true;
  }
}