import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { PendingTradeExpiredEvent } from '@trade/state/domain/events';
import { EditStateManager } from '../../domain/services/edit-state-manager.service';
import { TELEGRAM_PORT, TelegramPort } from '@telegram/core/domain/ports/telegram.port';
import { LOGGER_PORT, LoggerPort } from '@shared/domain/ports/logger.port';

@EventsHandler(PendingTradeExpiredEvent)
export class OnPendingTradeExpiredHandler implements IEventHandler<PendingTradeExpiredEvent> {
  private readonly logger: LoggerPort;

  constructor(
    private readonly editStateManager: EditStateManager,
    @Inject(TELEGRAM_PORT) private readonly telegram: TelegramPort,
    @Inject(LOGGER_PORT) logger: LoggerPort,
  ) {
    this.logger = logger;
  }

  async handle(event: PendingTradeExpiredEvent): Promise<void> {
    const { trade, reason } = event;

    this.logger.info(`[OnPendingTradeExpiredHandler] Handling expired trade: ${trade.id}`);

    if (trade.sourceChat) {
      const pendingState = this.editStateManager.getPendingTrade(trade.sourceChat, trade.id);
      if (pendingState?.confirmationMessageId) {
        try {
          await this.telegram.editMessage(
            trade.sourceChat,
            pendingState.confirmationMessageId,
            `❌ ${reason}\n\nTrade ${trade.symbol} has been cancelled.`,
          );
          this.logger.info(`[OnPendingTradeExpiredHandler] Edited confirmation message for trade ${trade.id}`);
        } catch (error) {
          this.logger.warn(`[OnPendingTradeExpiredHandler] Could not edit message: ${error}`);
        }
      }

      this.editStateManager.removePendingTrade(trade.sourceChat, trade.id);
      this.logger.info(`[OnPendingTradeExpiredHandler] Removed pending trade ${trade.id} from EditStateManager`);
    }
  }
}