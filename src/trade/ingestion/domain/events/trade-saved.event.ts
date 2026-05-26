import { Trade } from '@trade/shared';

/**
 * Event published after a trade is saved from ingestion (Telegram message).
 */
export class TradeSavedEvent {
  constructor(
    public readonly trade: Trade,
    public readonly sourceChatId: number,
    public readonly sourceMessage: string,
  ) {}
}