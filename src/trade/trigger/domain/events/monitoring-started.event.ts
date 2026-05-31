import { Trade } from '@trade/shared';

/**
 * Event emitted when monitoring starts for a trade.
 */
export class MonitoringStartedEvent {
  constructor(public readonly trade: Trade) {}
}