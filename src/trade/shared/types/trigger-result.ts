import { TriggerType } from './trigger';

/**
 * Result of checking price triggers against current price.
 */
export interface TriggerResult {
  triggered: boolean;
  trigger: TriggerType | null;
  price: number;
  tpIndex?: number;
  rr?: number;
}