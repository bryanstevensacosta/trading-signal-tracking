import { TradeStatus } from './trade-status';
import { TradeSide } from './trigger';
import { OrderType } from './order-type';

export type CancelledBy = 'user' | 'auto_timeout' | 'auto_message' | 'auto_command';

/**
 * Domain entity representing a trade.
 */
export interface Trade {
  id: string;
  symbol: string;
  side: TradeSide;
  orderType: OrderType;
  entry: number;
  entryMax: number | null;
  entryExecutedPrice: number | null;
  entryExecutedAt: Date | null;
  sl: number | null;
  tps: number[] | null;
  chartUrl: string | null;
  notes: string | null;
  status: TradeStatus;
  sourceMessage: string;
  sourceChat: number | null;
  tpsHit: number[];
  notificationMessageId: number | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  cancelledBy?: CancelledBy | null;
  approvedAt?: Date | null;
}

/**
 * Input for creating a new trade.
 */
export interface CreateTradeInput {
  symbol: string;
  side: TradeSide;
  orderType?: OrderType;
  entry: number;
  entryMax?: number;
  sl?: number;
  tps?: number[];
  chartUrl?: string;
  notes?: string;
  sourceMessage?: string;
  sourceChat?: number;
}

/**
 * Input for updating an existing trade.
 */
export interface UpdateTradeInput {
  entry?: number;
  entryMax?: number;
  entryExecutedPrice?: number;
  entryExecutedAt?: Date;
  sl?: number;
  tps?: number[];
  chartUrl?: string;
  notes?: string;
  status?: TradeStatus;
  tpsHit?: number[];
  closedAt?: Date;
  notificationMessageId?: number;
  cancelledBy?: CancelledBy | null;
  approvedAt?: Date | null;
}