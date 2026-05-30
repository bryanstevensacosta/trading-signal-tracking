import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TriggerDetectedEvent } from '../../domain/events/trigger-detected.event';
import { CommandBus } from '@nestjs/cqrs';
import { TransitionStateCommand } from '@trade/state/application/commands/transition-state.command';
import { TradeStatus } from '@trade/shared';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '@trade/repository/domain/ports/trade-repository.port';
import { LoggerPort, LOGGER_PORT } from '../../../../shared/domain/ports/logger.port';

const TERMINAL_STATES = [
  TradeStatus.CLOSED_WIN,
  TradeStatus.CLOSED_LOSS,
  TradeStatus.CLOSED_PARTIAL,
  TradeStatus.CLOSED_BREAKEVEN,
  TradeStatus.CLOSED_MANUAL,
  TradeStatus.CANCELLED,
];

@EventsHandler(TriggerDetectedEvent)
export class OnTriggerDetectedHandler implements IEventHandler<TriggerDetectedEvent> {
  constructor(
    private readonly commandBus: CommandBus,
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    @Inject(LOGGER_PORT) private readonly logger: LoggerPort,
  ) {}

  async handle(event: TriggerDetectedEvent): Promise<void> {
    const { trade, trigger, tpIndex, rr } = event;

    this.logger.info(`[OnTriggerDetected] Processing ${trigger} for trade ${trade.id} (current status from event: ${trade.status})`);

    const currentTrade = await this.repository.findById(trade.id);
    if (!currentTrade) {
      this.logger.warn(`[OnTriggerDetected] Trade ${trade.id} not found`);
      return;
    }

    if (TERMINAL_STATES.includes(currentTrade.status)) {
      this.logger.debug(`[OnTriggerDetected] Trade ${trade.id} is already in terminal state ${currentTrade.status}, ignoring ${trigger}`);
      return;
    }

    switch (trigger) {
      case 'entry':
        if (currentTrade.status !== 'pending') {
          this.logger.debug(`[OnTriggerDetected] Trade ${trade.id} is ${currentTrade.status}, ignoring entry`);
          return;
        }
        await this.repository.update(trade.id, {
          entryExecutedPrice: event.price,
          entryExecutedAt: new Date(),
        });
        await this.commandBus.execute(
          new TransitionStateCommand(trade.id, TradeStatus.ACTIVE, 'entry_triggered')
        );
        break;

      case 'tp': {
        const alreadyHit = currentTrade.tpsHit?.includes(tpIndex!);
        if (alreadyHit) {
          this.logger.debug(`[OnTriggerDetected] Trade ${trade.id} TP${tpIndex} already hit, ignoring`);
          return;
        }

        const tpsHit = [...(currentTrade.tpsHit || []), tpIndex!];
        const allTPHit = currentTrade.tps!.length === tpsHit.length;

        if (allTPHit) {
          await this.commandBus.execute(
            new TransitionStateCommand(trade.id, TradeStatus.CLOSED_WIN, 'all_tp_hit')
          );
        } else {
          await this.commandBus.execute(
            new TransitionStateCommand(trade.id, TradeStatus.PARTIAL_TP, 'partial_tp_hit', { tpsHit })
          );
        }
        break;
      }

      case 'sl': {
        const hasTpsHit = currentTrade.tpsHit && currentTrade.tpsHit.length > 0;
        if (hasTpsHit) {
          await this.commandBus.execute(
            new TransitionStateCommand(trade.id, TradeStatus.CLOSED_LOSS, 'sl_after_tp', { rr })
          );
        } else {
          await this.commandBus.execute(
            new TransitionStateCommand(trade.id, TradeStatus.CLOSED_LOSS, 'sl_triggered')
          );
        }
        break;
      }
    }
  }
}