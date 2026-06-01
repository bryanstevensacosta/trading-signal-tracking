import { Module, Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { LoggerModule } from '@shared';
import { BinanceSpotAdapter } from './infrastructure/adapters/binance-spot.adapter';
import { BinanceFuturesAdapter } from './infrastructure/adapters/binance-futures.adapter';
import { BinanceInfoAdapter } from './infrastructure/adapters/binance-info.adapter';
import { GetPriceHandler } from './application/queries/get-price/handler';
import {
  SubscribeToPriceHandler,
  SubscribeToMultiplePricesHandler,
} from './application/commands/subscribe-to-price/handler';
import { SPOT_PORT, FUTURES_PORT } from './tokens';
import { BINANCE_INFO_PORT } from './domain/ports/binance-info.port';

const SPOT_PORT_PROVIDER: Provider = {
  provide: SPOT_PORT,
  useClass: BinanceSpotAdapter,
};

const FUTURES_PORT_PROVIDER: Provider = {
  provide: FUTURES_PORT,
  useClass: BinanceFuturesAdapter,
};

const BINANCE_INFO_PORT_PROVIDER: Provider = {
  provide: BINANCE_INFO_PORT,
  useClass: BinanceInfoAdapter,
};

const COMMAND_HANDLERS = [SubscribeToPriceHandler, SubscribeToMultiplePricesHandler];
const QUERY_HANDLERS = [GetPriceHandler];

@Module({
  imports: [CqrsModule, LoggerModule],
  providers: [
    BinanceSpotAdapter,
    BinanceFuturesAdapter,
    BinanceInfoAdapter,
    SPOT_PORT_PROVIDER,
    FUTURES_PORT_PROVIDER,
    BINANCE_INFO_PORT_PROVIDER,
    ...COMMAND_HANDLERS,
    ...QUERY_HANDLERS,
  ],
  exports: [
    SPOT_PORT,
    FUTURES_PORT,
    BINANCE_INFO_PORT,
    BinanceSpotAdapter,
    BinanceFuturesAdapter,
    BinanceInfoAdapter,
  ],
})
export class BinanceProviderModule {}