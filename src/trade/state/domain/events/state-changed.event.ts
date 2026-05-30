import { Trade, TradeStatus } from '../../../shared/types';

/**
 * Event emitted when a trade's state changes.
 * 
 * @class StateChangedEvent
 * @property trade - The trade after the state change
 * @property oldStatus - The previous trade status
 * @property newStatus - The new trade status
 * @property reason - The reason for the transition (e.g., 'entry_triggered', 'sl_triggered')
 * 
 * @example
 * const event = new StateChangedEvent(trade, TradeStatus.PENDING, TradeStatus.ACTIVE, 'entry_triggered');
 */
export class StateChangedEvent {
  constructor(
    public readonly trade: Trade,
    public readonly oldStatus: TradeStatus,
    public readonly newStatus: TradeStatus,
    public readonly reason: string,
    public readonly rr?: number,
  ) {}
}