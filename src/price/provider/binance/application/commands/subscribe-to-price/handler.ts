import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { SPOT_PORT } from '../../../tokens';
import { SubscribeToPriceCommand, SubscribeToMultiplePricesCommand } from './command';
import { SubscribeToPriceResultDto, SubscribeToMultiplePricesResultDto } from './dto';
import { BinanceSpotPort } from '../../../domain/ports/binance-spot.port';

@CommandHandler(SubscribeToPriceCommand)
export class SubscribeToPriceHandler implements ICommandHandler<SubscribeToPriceCommand> {
  constructor(
    @Inject(SPOT_PORT) private readonly exchange: BinanceSpotPort,
  ) {}

  async execute(command: SubscribeToPriceCommand): Promise<SubscribeToPriceResultDto> {
    const unsubscribe = this.exchange.subscribeToTicker(command.symbol, command.onPriceUpdate);
    return { unsubscribe };
  }
}

@CommandHandler(SubscribeToMultiplePricesCommand)
export class SubscribeToMultiplePricesHandler implements ICommandHandler<SubscribeToMultiplePricesCommand> {
  constructor(
    @Inject(SPOT_PORT) private readonly exchange: BinanceSpotPort,
  ) {}

  async execute(command: SubscribeToMultiplePricesCommand): Promise<SubscribeToMultiplePricesResultDto> {
    const unsubscribe = this.exchange.subscribeToMultipleTickers(command.symbols, command.onPriceUpdate);
    return { unsubscribe };
  }
}