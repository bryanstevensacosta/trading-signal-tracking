import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PriceStreamService } from './domain/services/price-stream.service';
import { SubscribeSymbolsHandler } from './application/commands/subscribe-symbols/handler';
import { UnsubscribeSymbolsHandler } from './application/commands/unsubscribe-symbols/handler';
import { GetSubscribedSymbolsHandler } from './application/queries/get-subscribed-symbols/query';
import { BinanceProviderModule } from '@price/provider/binance/binance.module';
import { LoggerModule } from '../../shared/shared.module';

const CommandHandlers = [SubscribeSymbolsHandler, UnsubscribeSymbolsHandler];
const QueryHandlers = [GetSubscribedSymbolsHandler];

/**
 * Price Stream Module.
 * Manages WebSocket connections to exchanges and streams real-time prices.
 * 
 * @example
 * // Subscribe to symbols
 * const result = await commandBus.execute(new SubscribeSymbolsCommand(['BTCUSDT', 'ETHUSDT']));
 * 
 * // Get active subscriptions
 * const { symbols } = await queryBus.execute(new GetSubscribedSymbolsQuery());
 */
@Module({
  imports: [
    CqrsModule,
    forwardRef(() => BinanceProviderModule),
    LoggerModule,
  ],
  providers: [
    PriceStreamService,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [PriceStreamService],
})
export class PriceStreamModule {}