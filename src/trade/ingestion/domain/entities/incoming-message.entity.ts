import { MessageSourceVO } from '../value-objects/message-source.vo';

/**
 * Entity representing an incoming Telegram message.
 * This is a domain entity with identity (id).
 * 
 * @interface IncomingMessage
 * @property id - Unique identifier for the message
 * @property text - The message text content
 * @property source - Message source information
 * @property raw - Raw Telegram update object
 * @property receivedAt - When the message was received
 */
export interface IncomingMessage {
  id: string;
  text: string;
  source: MessageSourceVO;
  raw: unknown;
  receivedAt: Date;
}