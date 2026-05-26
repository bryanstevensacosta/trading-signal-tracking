import { Trade } from '@trade/shared';

/**
 * Event emitted when monitoring stops for a trade.
 */
export class MonitoringStoppedEvent {
  constructor(public readonly trade: Trade, public readonly reason: string) {}
}