import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PriceCacheService } from './domain/services/price-cache.service';
import { PRICE_CACHE_PORT } from './domain/ports/price-cache.port';
import { SetPriceHandler } from './application/commands/set-price/handler';
import { RemovePriceHandler } from './application/commands/remove-price/handler';
import { GetPriceHandler } from './application/queries/get-price/handler';
import { GetAllPricesHandler } from './application/queries/get-all-prices/handler';
import { OnPriceUpdatedHandler } from './application/event-handlers/on-price-updated.handler';
import { PriceStreamModule } from '@price/stream/price-stream.module';

export const CommandHandlers = [SetPriceHandler, RemovePriceHandler];
export const QueryHandlers = [GetPriceHandler, GetAllPricesHandler];
export const EventHandlers = [OnPriceUpdatedHandler];

/**
 * Price Cache Module
 * 
 * Provides in-memory caching for real-time prices.
 * Subscribes to price/stream events and provides fast price lookups.
 * 
 * @example
 * @Module({
 *   imports: [PriceCacheModule],
 * })
 * export class AppModule {}
 * 
 * **What price/cache does:**
 * - Caches real-time prices in memory
 * - Provides fast symbol → price lookups
 * - Subscribes to PriceUpdatedEvent from price/stream
 * 
 * **What price/cache does NOT do:**
 * - Connect to exchanges (that goes to price/exchange)
 * - Manage WebSocket connections (that goes to price/stream)
 * - Trade execution (that goes to trade/engine)
 */
@Module({
  imports: [
    CqrsModule,
    forwardRef(() => PriceStreamModule),
  ],
  providers: [
    { provide: PRICE_CACHE_PORT, useClass: PriceCacheService },
    PriceCacheService,
    ...CommandHandlers,
    ...QueryHandlers,
    ...EventHandlers,
  ],
  exports: [PriceCacheService, PRICE_CACHE_PORT],
})
export class PriceCacheModule {}