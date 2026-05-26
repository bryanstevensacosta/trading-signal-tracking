import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { LoggerModule } from '../../shared/shared.module';
import { IngestionService } from './domain/services/ingestion.service';
import { MessageFilterService } from './domain/services/message-filter.service';
import { IngestMessageHandler } from './application/commands/ingest-message/handler';
import { OnTradeReceivedHandler } from './application/event-handlers/on-trade-received.handler';
import { OnTradeSavedHandler } from './application/event-handlers/on-trade-saved.handler';
import { TelegramIngestionAdapter } from './infrastructure/adapters/telegram-ingestion.adapter';
import { TradeParsingModule } from '../parsing/trade-parsing.module';
import { TradeRepositoryModule } from '../repository/trade-repository.module';
import { TelegramNotificationSingleModule } from '../../telegram/notification/single-trade/telegram-notification-single.module';
import { TradeEngineModule } from '../engine/trade-engine.module';

export const CommandHandlers = [IngestMessageHandler];
export const EventHandlers = [OnTradeReceivedHandler, OnTradeSavedHandler];

/**
 * Trade Ingestion Module
 * 
 * Responsible for receiving trade messages from Telegram,
 * filtering non-trade content, and coordinating the parsing/saving workflow.
 * 
 * @module TradeIngestionModule
 * 
 * @example
 * @Module({
 *   imports: [TradeIngestionModule],
 * })
 * export class AppModule {}
 */
@Module({
  imports: [
    CqrsModule,
    LoggerModule,
    forwardRef(() => TradeParsingModule),
    forwardRef(() => TradeRepositoryModule),
    TelegramNotificationSingleModule,
    TradeEngineModule,
  ],
  providers: [
    IngestionService,
    MessageFilterService,
    TelegramIngestionAdapter,
    ...CommandHandlers,
    ...EventHandlers,
  ],
  exports: [IngestionService, MessageFilterService],
})
export class TradeIngestionModule {}