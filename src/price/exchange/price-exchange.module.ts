import { Module, Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { LoggerModule } from '@shared';
import { BinanceSpotAdapter } from './infrastructure/adapters/binance-spot.adapter';
import { BinanceFuturesAdapter } from './infrastructure/adapters/binance-futures.adapter';
import { GetPriceHandler } from './application/queries/get-price/handler';
import {
  SubscribeToPriceHandler,
  SubscribeToMultiplePricesHandler,
} from './application/commands/subscribe-to-price/handler';
import { SPOT_PORT, FUTURES_PORT } from './tokens';

const SPOT_PORT_PROVIDER: Provider = {
  provide: SPOT_PORT,
  useClass: BinanceSpotAdapter,
};

const FUTURES_PORT_PROVIDER: Provider = {
  provide: FUTURES_PORT,
  useClass: BinanceFuturesAdapter,
};

const COMMAND_HANDLERS = [SubscribeToPriceHandler, SubscribeToMultiplePricesHandler];
const QUERY_HANDLERS = [GetPriceHandler];

/**
 * Price exchange module.
 * Provides real-time cryptocurrency price data from Binance Spot and USD-M Futures.
 * 
 * @example
 * // Inject via SPOT_PORT token
 * constructor(@Inject(SPOT_PORT) private spotAdapter: BinanceSpotPort) {}
 * 
 * // Or inject the adapter directly
 * constructor(private spotAdapter: BinanceSpotAdapter) {}
 * 
 * // Or use via CQRS commands/queries
 * const price = await queryBus.execute(new GetPriceQuery('BTCUSDT'));
 */
@Module({
  imports: [CqrsModule, LoggerModule],
  providers: [
    BinanceSpotAdapter,
    BinanceFuturesAdapter,
    SPOT_PORT_PROVIDER,
    FUTURES_PORT_PROVIDER,
    ...COMMAND_HANDLERS,
    ...QUERY_HANDLERS,
  ],
  exports: [
    SPOT_PORT,
    FUTURES_PORT,
    BinanceSpotAdapter,
    BinanceFuturesAdapter,
  ],
})
export class PriceExchangeModule {}