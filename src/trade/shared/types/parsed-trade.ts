import { TradeSide } from './trigger';
import { OrderType } from './order-type';

/**
 * Trade data extracted from a Telegram message.
 */
export interface ParsedTradeData {
  symbol: string;
  side: TradeSide;
  orderType: OrderType;
  entry: number;
  entryMax: number | null;
  sl: number | null;
  tps: number[] | null;
  chartUrl: string | null;
  notes: string | null;
}