import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { MessageFilterService } from './message-filter.service';
import { MessageSourceVO } from '../value-objects/message-source.vo';
import { TradeReceivedEvent } from '../events/trade-received.event';
import { InvalidMessageEvent } from '../events/invalid-message.event';
import { LoggerPort, LOGGER_PORT } from '../../../../shared/domain/ports/logger.port';

/**
 * Domain service that orchestrates the message ingestion workflow.
 * Filters messages and emits appropriate events based on the result.
 * 
 * @class IngestionService
 * @description Main entry point for processing incoming Telegram messages
 * 
 * @example
 * await ingestionService.ingest('LONG BTCUSDT Entry: 50000', source);
 */
@Injectable()
export class IngestionService {
  private readonly logger: LoggerPort;

  constructor(
    private readonly filterService: MessageFilterService,
    @Inject(forwardRef(() => EventBus))
    private readonly eventBus: EventBus,
    @Inject(LOGGER_PORT) logger: LoggerPort,
  ) {
    this.logger = logger;
  }

  /**
   * Processes an incoming Telegram message.
   * Filters the message and emits appropriate domain events.
   * 
   * @param text - The message text to ingest
   * @param source - The message source information
   * @returns Promise that resolves when the message is processed
   * 
   * @example
   * await ingestionService.ingest('LONG BTCUSDT Entry: 50000 SL: 49000', source);
   * // Emits TradeReceivedEvent if valid trade message
   * // Emits InvalidMessageEvent if filtered out
   */
  async ingest(text: string, source: MessageSourceVO): Promise<void> {
    const filterResult = this.filterService.filter(text, source.chatId);

    this.logger.debug(`IngestionService: text="${text}", filterResult=${JSON.stringify(filterResult)}`);

    if (!filterResult.shouldProcess) {
      await this.eventBus.publish(
        new InvalidMessageEvent(text, source, filterResult.reason!),
      );
      this.logger.warn(`Message filtered: ${filterResult.reason}`);
      return;
    }

    await this.eventBus.publish(new TradeReceivedEvent(text, source));
    this.logger.debug(`TradeReceivedEvent published for: "${text}"`);
  }
}