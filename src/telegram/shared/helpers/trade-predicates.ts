import { TradeStatus } from '@trade/shared';
import { isActiveTrade, isClosedTrade, calculateTradeSummary } from '@trade/statistics/domain/services';

export { isActiveTrade, isClosedTrade, calculateTradeSummary };

export function isActive(status: TradeStatus): boolean {
  return isActiveTrade(status);
}

export function isClosed(status: TradeStatus): boolean {
  return isClosedTrade(status) || status === 'cancelled';
}