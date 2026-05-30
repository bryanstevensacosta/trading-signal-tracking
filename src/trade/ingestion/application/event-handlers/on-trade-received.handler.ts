import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { CommandBus } from '@nestjs/cqrs';
import { Inject, forwardRef } from '@nestjs/common';
import { TradeReceivedEvent } from '../../domain/events/trade-received.event';
import { ParseTradeCommand } from '../../../parsing/application/commands/parse-trade/command';
import { ParseResult } from '../../../parsing/domain/ports/parser.port';
import { SendConfirmationCommand } from '@telegram/notification/trade-approval/application/commands/send-confirmation/command';
import { LoggerPort, LOGGER_PORT } from '../../../../shared/domain/ports/logger.port';
import { PendingCleanupService } from '../../../state/domain/services/pending-cleanup.service';

/**
 * Handler for TradeReceivedEvent.
 * Coordinates parsing and sending confirmation for trade messages.
 */
@EventsHandler(TradeReceivedEvent)
export class OnTradeReceivedHandler implements IEventHandler<TradeReceivedEvent> {
  private readonly logger: LoggerPort;

  constructor(
    private readonly commandBus: CommandBus,
    @Inject(forwardRef(() => PendingCleanupService))
    private readonly pendingCleanupService: PendingCleanupService,
    @Inject(LOGGER_PORT) logger: LoggerPort,
  ) {
    this.logger = logger;
  }

  async handle(event: TradeReceivedEvent): Promise<void> {
    this.logger.info(`Processing trade message from chat ${event.source.chatId}: "${event.text}"`);

    await this.pendingCleanupService.cancelAllPending('New trade message received - previous pending trade cancelled', 'auto_message');

    const parseResult = await this.commandBus.execute<ParseTradeCommand, ParseResult>(
      new ParseTradeCommand(event.text),
    );

    this.logger.debug(`ParseResult: ${JSON.stringify(parseResult)}`);

    if (parseResult.success && parseResult.data) {
      await this.commandBus.execute(new SendConfirmationCommand(
        parseResult.data,
        event.source.chatId,
        event.text,
      ));

      this.logger.info(`Confirmation sent for ${parseResult.data.symbol}`);
    } else {
      this.handleParseFailure(event, parseResult);
    }
  }

  private handleParseFailure(event: TradeReceivedEvent, parseResult: ParseResult): void {
    const errorMessage = parseResult.errors.join(', ');
    this.logger.error(
      `Parse failed for message from chat ${event.source.chatId}: ${errorMessage}`,
    );

    this.logger.warn(
      `Notification not implemented yet. User in chat ${event.source.chatId} not notified of parse failure.`,
    );
  }
}