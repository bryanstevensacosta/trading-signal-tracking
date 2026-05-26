import { MessageSourceVO } from '../value-objects/message-source.vo';

/**
 * Event emitted when a message is filtered out or cannot be processed.
 * Reasons include: empty message, command, or not trade-related.
 * 
 * @class InvalidMessageEvent
 * @property text - The raw message text
 * @property source - The message source information
 * @property reason - Why the message was rejected (empty_message, is_command, not_trade_related)
 * 
 * @example
 * const event = new InvalidMessageEvent('/help', source, 'is_command');
 */
export class InvalidMessageEvent {
  constructor(
    public readonly text: string,
    public readonly source: MessageSourceVO,
    public readonly reason: string,
  ) {}
}