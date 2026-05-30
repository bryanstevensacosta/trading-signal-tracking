import { Trade, TriggerType } from '@trade/shared';

/**
 * Event fired when a trigger notification is sent.
 */
export class TriggerNotificationEvent {
  constructor(
    public readonly trade: Trade,
    public readonly trigger: TriggerType,
    public readonly price: number,
    public readonly rr?: number,
    public readonly tpIndex?: number,
  ) {}
}