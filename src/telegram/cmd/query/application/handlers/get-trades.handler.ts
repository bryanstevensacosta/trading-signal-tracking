import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject, forwardRef } from '@nestjs/common';
import { GetTradesCommand } from '../commands';
import { Trade } from '@trade/shared';
import { TRADE_REPOSITORY_PORT, TradeRepositoryPort } from '@trade/repository/domain/ports/trade-repository.port';
import { CommandResponse } from '../../../application/command-response';
import { TradeHistoryService } from '@trade/history/domain/services/trade-history.service';
import { PRICE_CACHE_PORT, PriceCachePort } from '@price/cache/domain/ports/price-cache.port';
import { TradeListService } from '@telegram/notification/trade-list/domain/services/trade-list.service';
import { formatTradeHistoryList, TradeHistoryRow } from '@telegram/shared/formatters/trade-history.formatter';
import { TradeStatisticsService } from '@trade/statistics/domain/services/trade-statistics.service';

@CommandHandler(GetTradesCommand)
export class GetTradesHandler implements ICommandHandler<GetTradesCommand> {
  constructor(
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    private readonly historyService: TradeHistoryService,
    @Inject(forwardRef(() => PRICE_CACHE_PORT))
    private readonly priceCache: PriceCachePort,
    private readonly displayService: TradeListService,
    private readonly statisticsService: TradeStatisticsService,
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

    if (command.filter === 'history') {
      if (command.exportCsv) {
        const csv = this.generateCsv(trades);
        return {
          success: true,
          message: '📊 History Export',
          file: { buffer: Buffer.from(csv), filename: `history_${Date.now()}.csv` },
        };
      }

      const historyRows: TradeHistoryRow[] = trades.map(t => ({
        direction: t.side,
        symbol: t.symbol,
        entry: t.entry,
        sl: t.sl || 0,
        tps: t.tps || [],
        status: t.status,
        tpsHit: t.tpsHit || [],
        entryExecutedPrice: t.entryExecutedPrice,
      }));
      const message = formatTradeHistoryList(historyRows);
      return { success: true, message };
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

  private generateCsv(trades: Trade[]): string {
    const header = 'date,market,symbol,entry,sl,tp,rr,status';
    const rows = trades.map(t => {
      const date = t.entryExecutedAt ? new Date(t.entryExecutedAt).toISOString().split('T')[0] : new Date(t.createdAt).toISOString().split('T')[0];
      const market = t.side;
      const symbol = t.symbol;
      const entry = t.entryExecutedPrice ?? t.entry;
      const sl = t.sl ?? '';
      const tp = t.tps ? t.tps.join(' ') : '';
      const rrResult = this.statisticsService.calculateRR(t);
      const rr = rrResult ? rrResult.rr.toFixed(2) : '';
      const status = t.status;
      return `${date},${market},${symbol},${entry},${sl},${tp},${rr},${status}`;
    });
    return [header, ...rows].join('\n');
  }
}