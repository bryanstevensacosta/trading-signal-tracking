import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { TelegramPort, TelegramReplyMarkup } from '@telegram/notification/single-trade/domain/ports/telegram.port';
import { LOGGER_PORT, LoggerPort } from '../../../../../shared/domain/ports/logger.port';

@Injectable()
export class TelegramMessageAdapter implements TelegramPort, OnModuleInit {
  private bot: Telegraf | null = null;
  private readonly logger: LoggerPort;

  constructor(@Inject(LOGGER_PORT) logger: LoggerPort) {
    this.logger = logger;
  }

  onModuleInit(): void {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not configured - notifications disabled');
      return;
    }
    this.bot = new Telegraf(token);
  }

  async sendMessage(chatId: number, text: string, replyMarkup?: TelegramReplyMarkup, messageThreadId?: number, replyToMessageId?: number): Promise<number> {
    if (!this.bot) {
      this.logger.warn('[TelegramMessageAdapter] Bot not initialized, skipping message');
      return 0;
    }

    const isPrivateChat = chatId > 0;
    const shouldUseThreadId = messageThreadId && !isPrivateChat;

    this.logger.info(`[TelegramMessageAdapter] sendMessage: chatId=${chatId}, isPrivate=${isPrivateChat}, threadId=${messageThreadId}, useThread=${shouldUseThreadId}, replyTo=${replyToMessageId}, textLen=${text.length}`);

    try {
      const extra: Record<string, unknown> = {
        parse_mode: 'HTML',
        ...replyMarkup,
      };
      if (shouldUseThreadId) {
        extra.message_thread_id = messageThreadId;
      }
      if (replyToMessageId) {
        extra.reply_to_message_id = replyToMessageId;
      }
      this.logger.info(`[TelegramMessageAdapter] Calling bot.telegram.sendMessage...`);
      const sentMessage = await this.bot.telegram.sendMessage(chatId, text, extra as any);
      this.logger.info(`[TelegramMessageAdapter] Message sent to ${chatId}, messageId=${sentMessage.message_id}`);
      return sentMessage.message_id;
    } catch (error) {
      this.logger.error(`[TelegramMessageAdapter] Failed to send message to ${chatId}:`, error);
      throw error;
    }
  }

  async editMessage(
    chatId: number,
    messageId: number,
    text: string,
    replyMarkup?: TelegramReplyMarkup,
    messageThreadId?: number,
  ): Promise<void> {
    if (!this.bot) {
      return;
    }

    const isPrivateChat = chatId > 0;
    const shouldUseThreadId = messageThreadId && !isPrivateChat;

    this.logger.debug(`editMessage: chatId=${chatId}, isPrivate=${isPrivateChat}, threadId=${messageThreadId}, useThread=${shouldUseThreadId}`);

    try {
      const extra: Record<string, unknown> = {
        parse_mode: 'HTML',
        ...replyMarkup,
      };
      if (shouldUseThreadId) {
        extra.message_thread_id = messageThreadId;
      }
      this.logger.debug(`Editing message ${messageId} in chat ${chatId} with extra: ${JSON.stringify({ parse_mode: 'HTML', message_thread_id: shouldUseThreadId ? messageThreadId : undefined })}`);
      await this.bot.telegram.editMessageText(chatId, messageId, undefined, text, extra as any);
      this.logger.debug(`Message ${messageId} edited in ${chatId}`);
    } catch (error) {
      this.logger.error(`Failed to edit message ${messageId} in ${chatId}:`, error);
      throw error;
    }
  }

  async deleteMessage(chatId: number, messageId: number, messageThreadId?: number): Promise<void> {
    if (!this.bot) {
      return;
    }

    try {
      if (messageThreadId) {
        await this.bot.telegram.deleteMessage(chatId, messageId);
      } else {
        await this.bot.telegram.deleteMessage(chatId, messageId);
      }
    } catch (error) {
      this.logger.error(`Failed to delete message ${messageId} from ${chatId}:`, error);
      throw error;
    }
  }
}