import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { SPOT_PORT } from '../../../tokens';
import { GetPriceQuery } from './query';
import { GetPriceResultDto } from './dto';
import { BinanceSpotPort } from '../../../domain/ports/binance-spot.port';

@QueryHandler(GetPriceQuery)
export class GetPriceHandler implements IQueryHandler<GetPriceQuery> {
  constructor(
    @Inject(SPOT_PORT) private readonly exchange: BinanceSpotPort,
  ) {}

  async execute(query: GetPriceQuery): Promise<GetPriceResultDto> {
    const price = await this.exchange.getTicker(query.symbol);
    return { price };
  }
}