import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { PriceUpdatedEvent } from '@price/stream/domain/events/price-updated.event';
import { TradingEngineService } from '../../domain/services/trading-engine.service';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '@trade/repository/domain/ports/trade-repository.port';

@EventsHandler(PriceUpdatedEvent)
export class OnPriceUpdatedHandler implements IEventHandler<PriceUpdatedEvent> {
  constructor(
    private readonly engine: TradingEngineService,
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
  ) {}

  async handle(event: PriceUpdatedEvent): Promise<void> {
    if (!event?.price?.symbol) {
      return;
    }
    const { symbol } = event.price;
    const trades = await this.repository.findBySymbol(symbol);

    for (const trade of trades) {
      if (!['pending', 'active', 'partial_tp', 'breakeven'].includes(trade.status)) continue;

      await this.engine.onPriceUpdateForSymbol(symbol, event.price);
    }
  }
}