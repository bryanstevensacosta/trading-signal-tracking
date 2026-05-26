import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { TelegramPort, TelegramReplyMarkup } from '@telegram/notification/trade-list/domain/ports/telegram.port';
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

  async sendMessage(chatId: number, text: string, replyMarkup?: TelegramReplyMarkup, messageThreadId?: number): Promise<number> {
    if (!this.bot) {
      this.logger.debug('Bot not initialized, skipping message');
      return 0;
    }

    try {
      const extra: Record<string, unknown> = {
        parse_mode: 'HTML',
        ...replyMarkup,
      };
      if (messageThreadId) {
        extra.message_thread_id = messageThreadId;
      }
      const sentMessage = await this.bot.telegram.sendMessage(chatId, text, extra as any);
      return sentMessage.message_id;
    } catch (error) {
      this.logger.error(`Failed to send message to ${chatId}:`, error);
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

    try {
      const extra: Record<string, unknown> = {
        parse_mode: 'HTML',
        ...replyMarkup,
      };
      if (messageThreadId) {
        extra.message_thread_id = messageThreadId;
      }
      await this.bot.telegram.editMessageText(chatId, messageId, undefined, text, extra as any);
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