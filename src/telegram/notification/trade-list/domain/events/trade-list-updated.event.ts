import { Trade } from '@trade/shared';

export class TradeListUpdatedEvent {
  constructor(
    public readonly trades: Trade[],
    public readonly chatId: number,
  ) {}
}