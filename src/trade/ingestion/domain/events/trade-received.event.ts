import { MessageSourceVO } from '../value-objects/message-source.vo';

/**
 * Event emitted when a valid trade message is received and passes filtering.
 * This event triggers the parsing and saving workflow.
 * 
 * @class TradeReceivedEvent
 * @property text - The raw message text
 * @property source - The message source information
 * 
 * @example
 * const event = new TradeReceivedEvent('LONG BTCUSDT Entry: 50000 SL: 49000', source);
 */
export class TradeReceivedEvent {
  constructor(
    public readonly text: string,
    public readonly source: MessageSourceVO,
  ) {}
}