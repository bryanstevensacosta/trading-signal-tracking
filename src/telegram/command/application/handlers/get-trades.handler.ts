import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject, forwardRef } from '@nestjs/common';
import { GetTradesCommand } from '../commands/query';
import { TRADE_PORT_TOKEN, TradePort } from '../../domain/ports';
import { CommandResponse } from '../../application/command-response';
import { TradeHistoryService } from '@trade/history/domain/services/trade-history.service';
import { PRICE_CACHE_PORT, PriceCachePort } from '@price/cache/domain/ports/price-cache.port';
import { TradeDisplayService } from '@telegram/notification/trade-list/domain/services/trade-display.service';

@CommandHandler(GetTradesCommand)
export class GetTradesHandler implements ICommandHandler<GetTradesCommand> {
  constructor(
    @Inject(TRADE_PORT_TOKEN) private readonly repository: TradePort,
    private readonly historyService: TradeHistoryService,
    @Inject(forwardRef(() => PRICE_CACHE_PORT))
    private readonly priceCache: PriceCachePort,
    private readonly displayService: TradeDisplayService,
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
    );

    return {
      success: true,
      message: result.trades.join('\n\n'),
    };
  }
}