import { ICommand } from '@nestjs/cqrs';
import { Trade } from '@trade/shared';

export type NotificationType = 'created' | 'entry' | 'tp' | 'partial_tp' | 'sl' | 'breakeven' | 'closed' | 'modified';

export class SendTradeNotificationCommand implements ICommand {
  constructor(
    public readonly trade: Trade,
    public readonly type: NotificationType,
    public readonly chatId: number,
    public readonly metadata?: NotificationMetadata,
  ) {}
}

export interface NotificationMetadata {
  trigger?: string;
  price?: number;
  rr?: number;
  tpIndex?: number;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
}