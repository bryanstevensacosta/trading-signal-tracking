/**
 * Represents the source of an incoming Telegram message.
 * 
 * @interface MessageSource
 * @property chatId - The Telegram chat ID
 * @property messageId - The message ID in Telegram
 * @property username - Optional Telegram username
 * @property firstName - Optional first name
 * @property timestamp - When the message was sent
 */
export interface MessageSource {
  chatId: number;
  messageId: number;
  username?: string;
  firstName?: string;
  timestamp: Date;
}

/**
 * Value object representing the source of a Telegram message.
 * Immutable and defined by its attributes.
 * 
 * @class MessageSourceVO
 * @implements MessageSource
 * 
 * @example
 * const source = new MessageSourceVO(123456789, 42, 'username', 'John', new Date());
 */
export class MessageSourceVO implements MessageSource {
  constructor(
    public readonly chatId: number,
    public readonly messageId: number,
    public readonly username?: string,
    public readonly firstName?: string,
    public readonly timestamp: Date = new Date(),
  ) {}

  /**
   * Creates a MessageSourceVO from a Telegram Bot API update object.
   * 
   * @param update - Telegram update object (message or edited_message)
   * @returns MessageSourceVO instance
   * @throws Error if no message or edited_message in update
   * 
   * @example
   * const source = MessageSourceVO.fromTelegram({ message: { chat: { id: 123 }, ... } });
   */
  static fromTelegram(update: {
    message?: {
      chat: { id: number };
      message_id: number;
      from?: { username?: string; first_name?: string };
      date: number;
    };
    edited_message?: {
      chat: { id: number };
      message_id: number;
      from?: { username?: string; first_name?: string };
      date: number;
    };
  }): MessageSourceVO {
    const message = update.message || update.edited_message;
    if (!message) {
      throw new Error('No message or edited_message in update');
    }

    const chat = message.chat;
    const user = message.from;

    return new MessageSourceVO(
      chat.id,
      message.message_id,
      user?.username,
      user?.first_name,
      new Date(message.date * 1000),
    );
  }
}