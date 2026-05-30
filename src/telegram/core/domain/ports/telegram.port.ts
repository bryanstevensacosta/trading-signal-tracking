export interface TelegramReplyMarkup {
  inline_keyboard?: TelegramInlineKeyboardButton[][];
  reply_markup?: string;
  parse_mode?: string;
}

export interface TelegramInlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export const TELEGRAM_PORT = Symbol('TelegramPort');

export interface TelegramPort {
  sendMessage(
    chatId: number,
    text: string,
    replyMarkup?: TelegramReplyMarkup,
    messageThreadId?: number,
    replyToMessageId?: number,
  ): Promise<number>;

  editMessage(
    chatId: number,
    messageId: number,
    text: string,
    replyMarkup?: TelegramReplyMarkup,
    messageThreadId?: number,
  ): Promise<void>;

  deleteMessage(
    chatId: number,
    messageId: number,
    messageThreadId?: number,
  ): Promise<void>;
}