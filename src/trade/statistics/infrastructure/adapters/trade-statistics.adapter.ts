import { Injectable } from '@nestjs/common';
import { TradeStatisticsPort, TradeStatistics } from '../../domain/ports/trade-statistics.port';
import { Trade } from '../../../shared/types';
import { TradeHistoryService } from '../../../history/domain/services/trade-history.service';

@Injectable()
export class TradeStatisticsAdapter implements TradeStatisticsPort {
  constructor(private readonly historyService: TradeHistoryService) {}

  async calculateStatistics(_trades: Trade[]): Promise<TradeStatistics> {
    const closedTrades = await this.historyService.findClosedTrades();
    return this.calculateFromTrades(closedTrades);
  }

  private calculateFromTrades(trades: Trade[]): TradeStatistics {
    const closedTrades = trades;
    const winningTrades = closedTrades.filter((t) =>
      t.status === 'closed_win' || t.status === 'closed_partial'
    );

    const winRate = closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0;

    return {
      totalTrades: trades.length,
      closedTrades: closedTrades.length,
      winRate,
      averageRR: 0,
      bestTrade: null,
      worstTrade: null,
      tradesThisWeek: 0,
      tradesThisMonth: 0,
      tradesThisYear: 0,
      winsBySymbol: {},
      lossesBySymbol: {},
    };
  }

  calculateRR(_trade: Trade): { rr: number; pnl: number } | null {
    return { rr: 0, pnl: 0 };
  }
}