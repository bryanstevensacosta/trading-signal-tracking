import { Price } from '@trade/shared';

/**
 * Event emitted when a price is updated in cache.
 */
export class PriceCachedEvent {
  constructor(public readonly price: Price, public readonly timestamp: Date = new Date()) {}
}