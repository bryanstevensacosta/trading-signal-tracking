import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { PriceUpdatedEvent } from '@price/stream/domain/events/price-updated.event';
import { PriceCacheService } from '../../domain/services/price-cache.service';

/**
 * Event handler for PriceUpdatedEvent.
 * Updates the price cache when prices change.
 */
@EventsHandler(PriceUpdatedEvent)
export class OnPriceUpdatedHandler
  implements IEventHandler<PriceUpdatedEvent>
{
  constructor(private readonly cache: PriceCacheService) {}

  /**
   * Handles the price updated event.
   * @param event - The price updated event
   */
  async handle(event: PriceUpdatedEvent): Promise<void> {
    if (!event?.price) {
      return;
    }
    this.cache.set(event.price);
  }
}