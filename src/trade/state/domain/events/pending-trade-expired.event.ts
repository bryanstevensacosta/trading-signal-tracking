import { Trade, CancelledBy } from '../../../shared/types';

/**
 * Event emitted when a pending trade is cancelled due to timeout.
 * 
 * @class PendingTradeExpiredEvent
 * @property trade - The trade that was cancelled
 * @property reason - The reason for cancellation
 * @property cancelledBy - Who/what cancelled the trade
 * 
 * @example
 * const event = new PendingTradeExpiredEvent(trade, 'Timeout: Trade cancelled after 15 minutes', 'auto_timeout');
 */
export class PendingTradeExpiredEvent {
  constructor(
    public readonly trade: Trade,
    public readonly reason: string,
    public readonly cancelledBy: CancelledBy,
  ) {}
}