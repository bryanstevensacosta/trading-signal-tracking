import { Injectable } from '@nestjs/common';
import { Trade, TradeStatus } from '../../../shared/types';
import { TradeStatisticsPort, TradeStatistics, CalculateRROutput, TradeSummary } from '../ports/trade-statistics.port';
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

    const rrs = closedTrades.map((t) => this.calculateRR(t)).filter((r): r is CalculateRROutput => r !== null);
    const averageRR = rrs.length > 0 ? rrs.reduce((sum, r) => sum + r.rr, 0) / rrs.length : 0;

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

    rrs.forEach((r, i) => {
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
    if (!trade.sl || trade.entry <= 0) {
      return null;
    }

    const isLong = trade.side === 'LONG';
    const riskAmount = Math.abs(trade.entry - trade.sl);

    if (riskAmount <= 0) {
      return null;
    }

    let pnl = 0;
    if (trade.entryExecutedPrice) {
      const priceDiff = isLong
        ? trade.entryExecutedPrice - trade.sl
        : trade.sl - trade.entryExecutedPrice;
      pnl = priceDiff / riskAmount;
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