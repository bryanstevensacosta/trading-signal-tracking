import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Context } from 'telegraf';
import { CommandBus } from '@nestjs/cqrs';
import { LOGGER_PORT, LoggerPort } from '@shared/domain/ports/logger.port';
import { EditStateManager } from '../../../notification/trade-approval/domain/services/edit-state-manager.service';
import { IngestMessageCommand } from '@trade/ingestion/application/commands/ingest-message/command';
import { MessageSourceVO } from '@trade/ingestion/domain/value-objects/message-source.vo';
import { EditTradeFieldCommand } from '../../../notification/trade-approval/application/commands/edit-trade-field/command';
import { PendingCleanupService } from '@trade/state/domain/services/pending-cleanup.service';

@Injectable()
export class TextHandlerService {
  private readonly logger: LoggerPort;

  constructor(
    private readonly commandBus: CommandBus,
    @Inject(forwardRef(() => EditStateManager))
    private readonly editStateManager: EditStateManager,
    @Inject(forwardRef(() => PendingCleanupService))
    private readonly pendingCleanupService: PendingCleanupService,
    @Inject(LOGGER_PORT) logger: LoggerPort,
  ) {
    this.logger = logger;
  }

  async handle(ctx: Context): Promise<void> {
    const message = ctx.message;
    if (!message || !('text' in message)) {
      return;
    }

    const text = message.text;

    if (text.startsWith('/')) {
      return;
    }

    const chatId = ctx.chat?.id || 0;

    const editingState = this.findEditingState(chatId);
    if (editingState) {
      this.logger.info(`Processing edit input for trade ${editingState.tradeId}, field: ${editingState.field}`);
      await this.commandBus.execute(new EditTradeFieldCommand(
        editingState.tradeId,
        editingState.field,
        text,
        chatId,
      ));
      this.editStateManager.clearEditingState(chatId, editingState.tradeId);
      return;
    }

    await this.pendingCleanupService.cancelAllPending('New message received - previous pending trade cancelled', 'auto_message');

    try {
      const source = MessageSourceVO.fromTelegram({
        message: {
          chat: message.chat,
          message_id: message.message_id,
          from: 'from' in message ? message.from : undefined,
          date: message.date,
        },
      });

      this.logger.debug(`Ingesting trade message: "${text}" from chat ${source.chatId}`);
      await this.commandBus.execute(new IngestMessageCommand(text, source));
      this.logger.debug(`Trade message ingested: "${text}"`);
    } catch (error) {
      this.logger.error(`Failed to ingest trade message: ${error}`);
      await ctx.reply('Failed to process message. Please try again.');
    }
  }

  private findEditingState(chatId: number): { tradeId: string; field: string } | null {
    const editingStates = this.editStateManager.getAllEditingStates();
    const state = editingStates.find(s => s.chatId === chatId && s.phase === 'waiting_for_value');
    return state ? { tradeId: state.tradeId, field: state.field } : null;
  }
}