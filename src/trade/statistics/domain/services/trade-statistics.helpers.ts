import { Trade, TradeStatus } from '../../../shared/types';
import { TradeSummary } from '../ports/trade-statistics.port';

export { TradeSummary };

export function isActiveTrade(status: TradeStatus): boolean {
  return ['pending', 'active', 'partial_tp', 'breakeven'].includes(status);
}

export function isClosedTrade(status: TradeStatus): boolean {
  return status.startsWith('closed_') || status === TradeStatus.CANCELLED;
}

export function isWinningTrade(status: TradeStatus): boolean {
  return status === TradeStatus.CLOSED_WIN || status === TradeStatus.CLOSED_PARTIAL;
}

export function calculateTradeSummary(trades: Trade[]): TradeSummary {
  const closed = trades.filter((t) => isClosedTrade(t.status));
  const wins = closed.filter((t) => isWinningTrade(t.status)).length;
  const losses = closed.filter((t) => t.status === 'closed_loss').length;
  const total = closed.length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  return { wins, losses, total, winRate };
}