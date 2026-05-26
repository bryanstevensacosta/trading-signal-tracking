import type { InlineKeyboardMarkup, InlineKeyboardButton } from '@telegraf/types/markup';

export const TELEGRAM_PORT = 'TELEGRAM_PORT';
export const NOTIFICATION_PORT = 'NOTIFICATION_PORT';

export { InlineKeyboardMarkup, InlineKeyboardButton };

/**
 * Port for sending messages via Telegram.
 */
export interface TelegramPort {
  sendMessage(chatId: number, text: string, replyMarkup?: TelegramReplyMarkup, messageThreadId?: number, replyToMessageId?: number): Promise<number>;
  editMessage(chatId: number, messageId: number, text: string, replyMarkup?: TelegramReplyMarkup, messageThreadId?: number): Promise<void>;
  deleteMessage(chatId: number, messageId: number, messageThreadId?: number): Promise<void>;
}

export interface TelegramReplyMarkup {
  parse_mode?: 'HTML' | 'Markdown';
  reply_markup?: InlineKeyboardMarkup;
}