import { Injectable } from '@nestjs/common';
import { ParsedTradeData } from '@trade/shared';
import { BinanceInfoData } from './binance-info.service';
import { formatSideEmoji, formatTps } from '@telegram/shared/helpers';

interface InlineButton {
  text: string;
  callback_data: string;
}

interface ConfirmationButtons {
  edit: InlineButton[][];
  approve: InlineButton[][];
  cancel: InlineButton[][];
}

@Injectable()
export class TradeApprovalService {
  formatConfirmation(
    trade: ParsedTradeData,
    binanceInfo: BinanceInfoData,
    tradeId: string,
  ): { text: string; buttons: ConfirmationButtons } {
    const sideEmoji = formatSideEmoji(trade.side);
    const tpsText = trade.tps ? formatTps(trade.tps) : 'N/A';

    const text = `
📊 Confirm Trade
${trade.symbol}

${sideEmoji} ${trade.side}
@ <code>${trade.entry}</code>
${trade.entryMax ? `📍 Entry Max: <code>${trade.entryMax}</code>` : ''}
🔴 SL: <code>${trade.sl || 'N/A'}</code>
🎯 TPs: <code>${tpsText}</code>

💰 Price: <code>${binanceInfo.price}</code> | ${binanceInfo.change24h} 24h
📊 Vol: ${binanceInfo.volume} | Range: <code>${binanceInfo.low}-${binanceInfo.high}</code>

Waiting for confirmation...
    `.trim();

    const buttons: ConfirmationButtons = {
      edit: [
        [{ text: '📋 Edit Trade', callback_data: `confirm_edit:${tradeId}` }],
      ],
      approve: [
        [{ text: '✅ Approve', callback_data: `confirm_approve:${tradeId}` }],
      ],
      cancel: [
        [{ text: '❌ Cancel', callback_data: `confirm_cancel:${tradeId}` }],
      ],
    };

    return { text, buttons };
  }

  formatEditMode(
    trade: ParsedTradeData,
    binanceInfo: BinanceInfoData,
    tradeId: string,
  ): { text: string; buttons: ConfirmationButtons } {
    const text = `
✏️ Edit Trade - ${trade.symbol.replace('USDT', '')}

Select field to edit:

🟢 Direction: ${trade.side}
📍 Entry: <code>${trade.entry}</code>
${trade.entryMax ? `📍 Entry Max: <code>${trade.entryMax}</code>` : ''}
🔴 SL: <code>${trade.sl || 'N/A'}</code>
🎯 TPs: <code>${trade.tps ? trade.tps.join(' / ') : 'N/A'}</code>

💰 Price: <code>${binanceInfo.price}</code> | ${binanceInfo.change24h} 24h
    `.trim();

    const buttons: ConfirmationButtons = {
      edit: [
        [
          { text: `Side: ${trade.side}`, callback_data: `edit_side:${tradeId}` },
          { text: `Entry: ${trade.entry}`, callback_data: `edit_entry:${tradeId}` },
        ],
        [
          { text: `SL: ${trade.sl || 'N/A'}`, callback_data: `edit_sl:${tradeId}` },
          { text: `TPs: ${trade.tps?.join(', ') || 'N/A'}`, callback_data: `edit_tps:${tradeId}` },
        ],
        [
          { text: '+ Add TP', callback_data: `edit_tp_add:${tradeId}` },
          { text: '- Remove TP', callback_data: `edit_tp_remove:${tradeId}` },
        ],
      ],
      approve: [
        [{ text: '💾 Save Changes', callback_data: `confirm_approve:${tradeId}` }],
      ],
      cancel: [
        [{ text: '❌ Cancel', callback_data: `confirm_cancel:${tradeId}` }],
      ],
    };

    return { text, buttons };
  }

  formatTradeConfirmed(trade: ParsedTradeData): string {
    const sideEmoji = formatSideEmoji(trade.side);
    const tpsText = trade.tps ? formatTps(trade.tps) : 'N/A';

    return `
✅ Trade Confirmed - ${trade.symbol.replace('USDT', '')}

${sideEmoji} Direction: ${trade.side}
📍 Entry: <code>${trade.entry}</code>
🔴 SL: <code>${trade.sl || 'N/A'}</code>
🎯 TPs: <code>${tpsText}</code>

Monitoring started...
    `.trim();
  }

  formatTradeClosed(symbol: string): string {
    return `
❌ Trade Closed - ${symbol.replace('USDT', '')}

Trade has been discarded.
    `.trim();
  }

  formatTradeApproved(trade: ParsedTradeData): string {
    return this.formatTradeConfirmed(trade);
  }
}