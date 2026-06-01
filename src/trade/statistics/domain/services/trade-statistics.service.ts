import { Injectable } from '@nestjs/common';
import { Trade, TradeStatus } from '../../../shared/types';
import { TradeStatisticsPort, TradeStatistics, CalculateRROutput, TradeSummary, ProfitabilityStatus } from '../ports/trade-statistics.port';
import { TradeHistoryService } from '../../../history/domain/services/trade-history.service';
import { isActiveTrade as checkActive, isClosedTrade as checkClosed, calculateTradeSummary as calcSummary, isWinningTrade as checkWin } from './trade-statistics.helpers';

export { isActiveTrade, isClosedTrade, calculateTradeSummary } from './trade-statistics.helpers';

@Injectable()
export class TradeStatisticsService implements TradeStatisticsPort {
  constructor(private readonly historyService: TradeHistoryService) {}

  async calculateStatisticsFromHistory(): Promise<TradeStatistics> {
    const closedTrades = await this.historyService.findClosedTrades();
    return this.calculateStatistics(closedTrades);
  }

  async calculateStatistics(trades: Trade[]): Promise<TradeStatistics> {
    const closedTrades = trades.filter((t) => checkClosed(t.status));
    const winningTrades = closedTrades.filter((t) => checkWin(t.status));

    const winRate = closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0;

    const allRRs = closedTrades.map((t) => this.calculateRR(t)).filter((r): r is CalculateRROutput => r !== null);
    const totalRR = allRRs.length > 0 ? allRRs.reduce((sum, r) => sum + r.rr, 0) : 0;
    const averageRR = allRRs.length > 0 ? totalRR / allRRs.length : 0;

    const winningTradesRRs = allRRs.filter((r) => r.rr > 0);
    const avgWinningRR = winningTradesRRs.length > 0
      ? winningTradesRRs.reduce((sum, r) => sum + r.rr, 0) / winningTradesRRs.length
      : 0;

    const breakEvenRate = avgWinningRR > 0 ? 1 / (1 + avgWinningRR) : 1;
    const profitability: ProfitabilityStatus = winRate > breakEvenRate ? 'PROFITABLE' : winRate === breakEvenRate ? 'BREAKEVEN' : 'UNPROFITABLE';

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const tradesThisWeek = closedTrades.filter((t) => new Date(t.createdAt) >= weekAgo).length;
    const tradesThisMonth = closedTrades.filter((t) => new Date(t.createdAt) >= monthAgo).length;
    const tradesThisYear = closedTrades.filter((t) => new Date(t.createdAt) >= yearAgo).length;

    const winsBySymbol: Record<string, number> = {};
    const lossesBySymbol: Record<string, number> = {};

    closedTrades.forEach((t) => {
      const isWin = checkWin(t.status);
      winsBySymbol[t.symbol] = (winsBySymbol[t.symbol] || 0) + (isWin ? 1 : 0);
      lossesBySymbol[t.symbol] = (lossesBySymbol[t.symbol] || 0) + (isWin ? 0 : 1);
    });

    let bestTrade: TradeStatistics['bestTrade'] = null;
    let worstTrade: TradeStatistics['worstTrade'] = null;

    allRRs.forEach((r, i: number) => {
      const trade = closedTrades[i];
      const tradeBest = { symbol: trade.symbol, rr: r.rr, pnl: r.pnl, closedAt: trade.closedAt || trade.createdAt };

      if (!bestTrade || r.rr > bestTrade.rr) {
        bestTrade = tradeBest;
      }
      if (!worstTrade || r.rr < worstTrade.rr) {
        worstTrade = tradeBest;
      }
    });

    return {
      totalTrades: trades.length,
      closedTrades: closedTrades.length,
      winRate,
      averageRR,
      totalRR,
      breakEvenRate,
      profitability,
      bestTrade,
      worstTrade,
      tradesThisWeek,
      tradesThisMonth,
      tradesThisYear,
      winsBySymbol,
      lossesBySymbol,
    };
  }

  calculateRR(trade: Trade): CalculateRROutput | null {
    if (!trade.sl || trade.entry <= 0 || !trade.tps?.length) {
      return null;
    }

    const isLong = trade.side === 'LONG';
    const entryPrice = trade.entryExecutedPrice ?? trade.entry;

    if (!entryPrice || entryPrice <= 0) {
      return null;
    }

    const riskAmount = Math.abs(entryPrice - trade.sl);
    if (riskAmount <= 0) {
      return null;
    }

    let tp: number | null = null;

    if (trade.tpsHit && trade.tpsHit.length > 0) {
      const lastTpIndex = trade.tpsHit[trade.tpsHit.length - 1];
      tp = trade.tps?.[lastTpIndex] ?? null;
    } else if (trade.status === TradeStatus.CLOSED_WIN || trade.status === TradeStatus.CLOSED_PARTIAL) {
      tp = trade.tps?.[trade.tps.length - 1] ?? null;
    }

    if (!tp) {
      return null;
    }

    let pnl = 0;
    const isLoss = trade.status === TradeStatus.CLOSED_LOSS;
    const isWin = trade.status === TradeStatus.CLOSED_WIN || trade.status === TradeStatus.CLOSED_PARTIAL;

    if (isLoss) {
      pnl = -1;
    } else if (isWin) {
      const reward = isLong
        ? tp - entryPrice
        : entryPrice - tp;
      pnl = reward / riskAmount;
    }

    const rr = pnl;
    return { rr, pnl };
  }

  isActiveTrade(status: TradeStatus): boolean {
    return checkActive(status);
  }

  isClosedTrade(status: TradeStatus): boolean {
    return checkClosed(status);
  }

  calculateTradeSummary(trades: Trade[]): TradeSummary {
    return calcSummary(trades);
  }
}