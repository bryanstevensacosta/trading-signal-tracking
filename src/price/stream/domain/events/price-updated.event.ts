import { Price } from '@trade/shared';

/**
 * Event emitted when a price is updated.
 */
export class PriceUpdatedEvent {
  constructor(public readonly price: Price) {}
}