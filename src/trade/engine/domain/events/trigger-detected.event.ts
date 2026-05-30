import { Trade, TriggerType } from '@trade/shared';

/**
 * Event emitted when a trigger is detected (entry, TP, or SL hit).
 */
export class TriggerDetectedEvent {
  constructor(
    public readonly trade: Trade,
    public readonly trigger: TriggerType,
    public readonly price: number,
    public readonly rr?: number,
    public readonly tpIndex?: number,
    public readonly lastTpIndex?: number,
  ) {}
}