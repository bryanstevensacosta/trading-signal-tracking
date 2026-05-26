import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { LoggerPort, LOGGER_PORT } from '../../../../shared/domain/ports/logger.port';

/**
 * Telegram adapter that listens for incoming messages.
 * Converts Telegram updates to IngestMessageCommands.
 *
 * NOTE: This adapter is currently disabled because TelegramBotAdapter handles
 * both commands and ingestion. The TelegramIngestionAdapter will only be used
 * if we need separate message handling for trade ingestion.
 *
 * @class TelegramIngestionAdapter
 * @description Listens to Telegram Bot API for new messages
 */
@Injectable()
export class TelegramIngestionAdapter implements OnModuleInit {
  private readonly logger: LoggerPort;

  constructor(
    private readonly commandBus: CommandBus,
    @Inject(LOGGER_PORT) logger: LoggerPort,
  ) {
    this.logger = logger;
  }

  /**
   * Initializes the Telegram bot when the module starts.
   * Currently disabled - TelegramBotAdapter handles ingestion instead.
   */
  onModuleInit(): void {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set - Telegram ingestion disabled');
      return;
    }

    this.logger.warn('TelegramIngestionAdapter is disabled - using TelegramBotAdapter for ingestion');
  }

  /**
   * Lifecycle hook called when the module is being destroyed.
   */
  onModuleDestroy(): void {
    this.logger.info('Telegram ingestion adapter destroyed');
  }
}