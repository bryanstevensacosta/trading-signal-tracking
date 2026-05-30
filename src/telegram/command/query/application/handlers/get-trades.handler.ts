import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject, forwardRef } from '@nestjs/common';
import { GetTradesCommand } from '../commands';
import { TRADE_REPOSITORY_PORT, TradeRepositoryPort } from '@trade/repository/domain/ports/trade-repository.port';
import { CommandResponse } from '../../../../command/application/command-response';
import { TradeHistoryService } from '@trade/history/domain/services/trade-history.service';
import { PRICE_CACHE_PORT, PriceCachePort } from '@price/cache/domain/ports/price-cache.port';
import { TradeListService } from '@telegram/notification/trade-list/domain/services/trade-list.service';

@CommandHandler(GetTradesCommand)
export class GetTradesHandler implements ICommandHandler<GetTradesCommand> {
  constructor(
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    private readonly historyService: TradeHistoryService,
    @Inject(forwardRef(() => PRICE_CACHE_PORT))
    private readonly priceCache: PriceCachePort,
    private readonly displayService: TradeListService,
  ) {}

  async execute(command: GetTradesCommand): Promise<CommandResponse> {
    let trades;

    switch (command.filter) {
      case 'active':
        trades = await this.repository.findActive();
        break;
      case 'pending':
        trades = await this.repository.findPending();
        break;
      case 'closed':
        trades = await this.historyService.findClosedTrades();
        break;
      case 'history':
        trades = await this.historyService.findHistoryTrades();
        break;
      default:
        trades = await this.repository.findActive();
    }

    const symbols = [...new Set(trades.map(t => t.symbol))];
    const prices = this.priceCache.getBySymbols(symbols);

    const result = this.displayService.formatTradeList(
      trades,
      prices,
      command.page,
      10,
      true,
    );

    return {
      success: true,
      message: result.trades.join('\n\n'),
    };
  }
}