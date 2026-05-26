import { Trade, TradeStatus } from '@trade/shared';

export interface StatePort {
  canTransition(trade: Trade, targetStatus: TradeStatus): boolean;
  transition(trade: Trade, targetStatus: TradeStatus, reason?: string): Promise<{ success: boolean; error?: string }>;
}