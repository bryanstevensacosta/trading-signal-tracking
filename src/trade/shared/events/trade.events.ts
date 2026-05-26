import { Trade, TradeStatus, TriggerType } from '../types';

/**
 * Event fired when a trade is created.
 */
export interface TradeCreatedEvent {
  trade: Trade;
}

/**
 * Event fired when a trade field is updated.
 */
export class TradeUpdatedEvent {
  constructor(
    public readonly trade: Trade,
    public readonly field: string,
    public readonly oldValue: unknown,
    public readonly newValue: unknown,
  ) {}
}

/**
 * Event fired when trade status changes.
 */
export interface StateChangedEvent {
  trade: Trade;
  oldStatus: TradeStatus;
  newStatus: TradeStatus;
  reason: string;
}

/**
 * Event fired when a price trigger is detected.
 */
export interface TriggerDetectedEvent {
  trade: Trade;
  trigger: TriggerType;
  price: number;
  rr?: number;
  tpIndex?: number;
}

/**
 * Event fired when a trade is closed.
 */
export interface TradeClosedEvent {
  trade: Trade;
  reason: string;
  pnl?: number;
}