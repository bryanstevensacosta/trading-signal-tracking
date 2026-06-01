import { Trade, TradeStatus } from '../../../shared/types';
import { isActiveTrade, isClosedTrade, isWinningTrade } from '../../../shared/helpers/state-helpers';
import { TradeSummary } from '../ports/trade-statistics.port';

export { TradeSummary, isActiveTrade, isClosedTrade, isWinningTrade };

export function calculateTradeSummary(trades: Trade[]): TradeSummary {
  const closed = trades.filter((t) => isClosedTrade(t.status));
  const wins = closed.filter((t) => isWinningTrade(t.status)).length;
  const losses = closed.filter((t) => t.status === TradeStatus.CLOSED_LOSS).length;
  const total = closed.length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  return { wins, losses, total, winRate };
}