import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { GetStatsCommand } from '../commands';
import { TradeStatisticsService } from '@trade/statistics/domain/services/trade-statistics.service';
import { TelegramFormatter } from '@telegram/shared/formatters';
import { CommandResponse } from '../../../../command/application/command-response';

@CommandHandler(GetStatsCommand)
export class GetStatsHandler implements ICommandHandler<GetStatsCommand> {
  constructor(
    private readonly statisticsService: TradeStatisticsService,
    private readonly formatter: TelegramFormatter,
  ) {}

  async execute(): Promise<CommandResponse> {
    const stats = await this.statisticsService.calculateStatisticsFromHistory();

    return {
      success: true,
      message: this.formatter.format({
        totalTrades: stats.totalTrades,
        winRate: stats.winRate,
        averageRR: stats.averageRR,
        bestTrade: stats.bestTrade?.rr ?? 0,
        worstTrade: stats.worstTrade?.rr ?? 0,
        tradesThisWeek: stats.tradesThisWeek,
        tradesThisMonth: stats.tradesThisMonth,
      }),
    };
  }
}