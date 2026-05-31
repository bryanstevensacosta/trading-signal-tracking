import { calculateRR } from '@trade/shared';
import { TradeSide } from '@trade/shared';
import { TELEGRAM_LABELS, TRADE_STATUS_HISTORY } from '../constants/telegram.constants';
import { TradeStatus } from '@trade/shared';

export interface TradeHistoryRow {
  direction: TradeSide;
  symbol: string;
  entry: number;
  sl: number;
  tps: number[];
  status: TradeStatus;
  tpsHit: number[];
  entryExecutedPrice: number | null;
}

function getStatusLabel(status: TradeStatus, tpsHit: number[], tps: number[]): string {
  if (tpsHit.length > 0 && tps.length > 0) {
    const lastTpIndex = tpsHit[tpsHit.length - 1];
    if (status === 'active' || status === 'partial_tp' || status === 'breakeven') {
      return `ACTIVE | TP${lastTpIndex + 1}`;
    }
    if (status === 'closed_win' || status === 'closed_partial') {
      return `CLOSED AT TP`;
    }
  }

  return TRADE_STATUS_HISTORY[status] || status;
}

function calculateRrForLastTP(
  entry: number,
  sl: number,
  tps: number[],
  tpsHit: number[],
  side: TradeSide,
  status: TradeStatus
): number | null {
  if (status === 'closed_loss') {
    return -1;
  }

  if (status === 'closed_breakeven') {
    return 0;
  }

  if (!tps || tps.length === 0) return null;

  let lastTpIndex: number;
  let lastTP: number;

  if (tpsHit.length > 0) {
    lastTpIndex = tpsHit[tpsHit.length - 1];
    lastTP = tps[lastTpIndex];
  } else if (status === 'closed_win' || status === 'closed_partial') {
    lastTpIndex = tps.length - 1;
    lastTP = tps[lastTpIndex];
  } else {
    return null;
  }

  if (lastTP === undefined) return null;

  return calculateRR(entry, sl, lastTP, side);
}

function formatPrice(price: number): string {
  return price.toString();
}

export function formatTradeHistoryRow(data: TradeHistoryRow): string {
  const { direction, symbol, entry, sl, tps, status, tpsHit, entryExecutedPrice } = data;

  const entryPrice = entryExecutedPrice || entry;
  const statusLabel = getStatusLabel(status, tpsHit, tps);
  const rr = calculateRrForLastTP(entryPrice, sl, tps, tpsHit, direction, status);

  const lines: string[] = [];

  lines.push(`${direction} ${symbol}`);
  lines.push(`${TELEGRAM_LABELS.fields.entry}: ${formatPrice(entryPrice)}`);
  lines.push(`${TELEGRAM_LABELS.fields.sl}: ${formatPrice(sl)}`);
  lines.push(`${TELEGRAM_LABELS.fields.tp}: ${tps.map(formatPrice).join(' | ')}`);
  lines.push(`${TELEGRAM_LABELS.fields.status}: ${statusLabel}`);
  lines.push(`${TELEGRAM_LABELS.fields.rr}: ${rr !== null ? (rr >= 0 ? '+' : '') + (Number.isInteger(rr) ? rr.toString() : rr.toFixed(2)) : 'N/A'}`);

  return lines.join('\n');
}

export function formatTradeHistoryList(trades: TradeHistoryRow[]): string {
  if (trades.length === 0) {
    return `${TELEGRAM_LABELS.trades} <b>TRADES</b>\n\nNo trades yet`;
  }

  const header = `${TELEGRAM_LABELS.trades} <b>TRADES</b> (${trades.length})`;
  const tradeLines = trades.map(formatTradeHistoryRow);

  return [header, ...tradeLines].join('\n\n');
}