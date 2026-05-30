import { Trade } from '@trade/shared';

/**
 * Port for sending trade notifications.
 * Implemented by the application layer.
 */
export interface NotificationPort {
  sendTradeCreated(trade: Trade): Promise<void>;
  sendEntryTriggered(trade: Trade): Promise<void>;
  sendTPHit(trade: Trade, tpIndex: number, rr: number): Promise<void>;
  sendPartialTP(trade: Trade, tpIndex: number, rr: number): Promise<void>;
  sendSLHit(trade: Trade, rr: number): Promise<void>;
  sendBreakeven(trade: Trade): Promise<void>;
  sendTradeClosed(trade: Trade, reason: string): Promise<void>;
  sendModification(trade: Trade, field: string, oldValue: unknown, newValue: unknown): Promise<void>;
}