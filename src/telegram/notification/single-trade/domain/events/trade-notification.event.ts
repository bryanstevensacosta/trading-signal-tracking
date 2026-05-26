import { Trade } from '@trade/shared';

/**
 * Event fired when a trade notification is sent.
 */
export class TradeNotificationEvent {
  constructor(
    public readonly trade: Trade,
    public readonly type: 'created' | 'closed' | 'modified' | 'trigger',
    public readonly metadata?: TradeNotificationMetadata,
  ) {}
}

export interface TradeNotificationMetadata {
  chatId?: number;
  messageId?: number;
  trigger?: string;
  rr?: number;
  tpIndex?: number;
}