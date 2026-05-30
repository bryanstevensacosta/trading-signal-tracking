import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { Telegraf, Context, Composer } from 'telegraf';
import {
  TelegramPort,
  TelegramReplyMarkup,
} from '../../domain/ports/telegram.port';
import { LOGGER_PORT, LoggerPort } from '@shared/domain/ports/logger.port';

@Injectable()
export class TelegrafCoreAdapter implements TelegramPort, OnModuleInit, OnModuleDestroy {
  private bot: Telegraf | null = null;
  private readonly logger: LoggerPort;

  private onTextHandler: (ctx: Context) => Promise<void>;
  private onCallbackHandler: (ctx: Context) => Promise<void>;
  private commandHandlers: Map<string, (ctx: Context) => Promise<void>> = new Map();

  constructor(@Inject(LOGGER_PORT) logger: LoggerPort) {
    this.logger = logger;
  }

  async onModuleInit(): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set - Telegram bot disabled');
      return;
    }

    this.bot = new Telegraf(token);
    await this.registerMenuCommands();
    this.setupHandlers();
    this.bot.launch();
    this.logger.info('Telegram bot started');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.bot) {
      this.bot.stop();
      this.logger.info('Telegram bot stopped');
    }
  }

  // Registrar comandos del menú de Telegram (/start, /help, etc.)
  private async registerMenuCommands(): Promise<void> {
    if (!this.bot) return;

    const commands = [
      { command: 'start', description: 'Start the bot' },
      { command: 'help', description: 'Show all commands' },
      { command: 'trades', description: 'List all trades' },
      { command: 'active', description: 'Show active trades' },
      { command: 'history', description: 'Show trade history' },
      { command: 'stats', description: 'Show trading statistics' },
      { command: 'cancel', description: 'Cancel a trade (Usage: /cancel <trade_id>)' },
      { command: 'delete', description: 'Delete a trade (Usage: /delete <trade_id>)' },
      { command: 'entry', description: 'Modify entry price (Usage: /entry <id> <price>)' },
      { command: 'sl', description: 'Modify stop loss (Usage: /sl <id> <price>)' },
      { command: 'tp', description: 'Modify take profit (Usage: /tp <id> <tp_num> <price>)' },
      { command: 'close', description: 'Close a trade (Usage: /close <trade_id>)' },
      { command: 'be', description: 'Move to breakeven (Usage: /be <trade_id>)' },
      { command: 'open', description: 'Force open a trade (Usage: /open <trade_id>)' },
      { command: 'trade', description: 'Get trade by ID (Usage: /trade <trade_id>)' },
      { command: 'clean', description: 'Delete all trades from database' },
    ];

    try {
      await this.bot.telegram.setMyCommands(commands);
      this.logger.info('Bot commands registered successfully');
    } catch (error) {
      this.logger.error('Failed to register bot commands:', error);
    }
  }

  // Configurar handlers que fueron inyectados
  private setupHandlers(): void {
    if (!this.bot) return;

    // Usar Composer.privateChat para filtrar solo chats privados
    const privateOnly = Composer.privateChat;

    // Registrar comandos slash (solo privado)
    for (const [command, handler] of this.commandHandlers) {
      this.bot!.command(command, privateOnly(handler));
    }

    // Handler de texto libre (solo privado)
    if (this.onTextHandler) {
      this.bot.on('text', privateOnly(this.onTextHandler));
    }

    // Handler de callbacks (botones inline) - también solo privado
    if (this.onCallbackHandler) {
      this.bot.on('callback_query', privateOnly(this.onCallbackHandler));
    }
  }

  // Métodos para inyectar handlers desde el módulo
  setTextHandler(handler: (ctx: Context) => Promise<void>): void {
    this.onTextHandler = handler;
  }

  setCallbackHandler(handler: (ctx: Context) => Promise<void>): void {
    this.onCallbackHandler = handler;
  }

  registerCommandHandler(command: string, handler: (ctx: Context) => Promise<void>): void {
    this.commandHandlers.set(command, handler);
  }

  // Implementación de TelegramPort
  async sendMessage(
    chatId: number,
    text: string,
    replyMarkup?: TelegramReplyMarkup,
    messageThreadId?: number,
    replyToMessageId?: number,
  ): Promise<number> {
    if (!this.bot) {
      this.logger.warn('[TelegrafCoreAdapter] Bot not initialized');
      return 0;
    }

    const isPrivateChat = chatId > 0;
    const shouldUseThreadId = messageThreadId && !isPrivateChat;

    try {
      const extra: Record<string, unknown> = {
        parse_mode: 'HTML',
        ...replyMarkup,
      };
      if (shouldUseThreadId) extra.message_thread_id = messageThreadId;
      if (replyToMessageId) extra.reply_to_message_id = replyToMessageId;

      const sentMessage = await this.bot.telegram.sendMessage(chatId, text, extra as Record<string, unknown>);
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
    if (!this.bot) return;

    try {
      const extra: Record<string, unknown> = {
        parse_mode: 'HTML',
        ...replyMarkup,
      };
      if (messageThreadId) extra.message_thread_id = messageThreadId;

      await this.bot.telegram.editMessageText(chatId, messageId, undefined, text, extra as Record<string, unknown>);
    } catch (error) {
      this.logger.error(`Failed to edit message ${messageId} in ${chatId}:`, error);
      throw error;
    }
  }

  async deleteMessage(
    chatId: number,
    messageId: number,
    _messageThreadId?: number,
  ): Promise<void> {
    if (!this.bot) return;

    try {
      await this.bot.telegram.deleteMessage(chatId, messageId);
    } catch (error) {
      this.logger.error(`Failed to delete message ${messageId} from ${chatId}:`, error);
      throw error;
    }
  }
}