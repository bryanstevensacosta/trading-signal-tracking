import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TriggerDetectedEvent } from '../../domain/events/trigger-detected.event';
import { CommandBus } from '@nestjs/cqrs';
import { TransitionStateCommand } from '@trade/state/application/commands/transition-state.command';
import { TradeStatus } from '@trade/shared';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '@trade/repository/domain/ports/trade-repository.port';
import { LoggerPort, LOGGER_PORT } from '../../../../shared/domain/ports/logger.port';
import { FUTURES_PORT } from '@price/provider/binance/tokens';
import type { BinanceFuturesPort } from '@price/provider/binance/domain/ports/binance-futures.port';

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
    @Inject(FUTURES_PORT) private readonly futuresExchange: BinanceFuturesPort,
  ) {}

  async handle(event: TriggerDetectedEvent): Promise<void> {
    const { trade, trigger, tpIndex, rr } = event;

    this.logger.info(`[OnTriggerDetected] Processing ${trigger} for trade ${trade.id} (current status from event: ${trade.status})`);

    try {
      let currentTrade = await this.repository.findById(trade.id);
      if (!currentTrade) {
        this.logger.warn(`[OnTriggerDetected] Trade ${trade.id} not found`);
        return;
      }

      if (TERMINAL_STATES.includes(currentTrade.status)) {
        this.logger.debug(`[OnTriggerDetected] Trade ${trade.id} is already in terminal state ${currentTrade.status}, ignoring ${trigger}`);
        return;
      }

      switch (trigger) {
        case 'entry': {
          if (currentTrade.status !== 'pending') {
            this.logger.debug(`[OnTriggerDetected] Trade ${trade.id} is ${currentTrade.status}, ignoring entry`);
            return;
          }
          const precision = this.futuresExchange.getSymbolPrecision(trade.symbol);
          const roundedPrice = Math.round(event.price * Math.pow(10, precision)) / Math.pow(10, precision);
          this.logger.info(`[OnTriggerDetected] ${trade.id}: Entry trigger - updating entryExecutedPrice to ${roundedPrice} (precision: ${precision})`);
          await this.repository.update(trade.id, {
            entryExecutedPrice: roundedPrice,
            entryExecutedAt: new Date(),
          });
          this.logger.info(`[OnTriggerDetected] ${trade.id}: Calling TransitionStateCommand to ACTIVE`);
          await this.commandBus.execute(
            new TransitionStateCommand(trade.id, TradeStatus.ACTIVE, 'entry_triggered')
          );
          this.logger.info(`[OnTriggerDetected] ${trade.id}: Transition to ACTIVE completed`);
          break;
        }

        case 'tp': {
          // Si el trade está en pending con entry ejecutada, primero cambiar a active
          if (currentTrade.status === 'pending' && currentTrade.entryExecutedAt) {
            this.logger.info(`[OnTriggerDetected] ${trade.id}: Trade is pending with entry executed, transitioning to ACTIVE first`);
            await this.commandBus.execute(
              new TransitionStateCommand(trade.id, TradeStatus.ACTIVE, 'entry_already_executed')
            );
            // Obtener el trade actualizado
            currentTrade = await this.repository.findById(trade.id);
            if (!currentTrade) {
              this.logger.error(`[OnTriggerDetected] ${trade.id}: Trade not found after transition to ACTIVE`);
              return;
            }
          }
          
          if (currentTrade.status !== 'active' && currentTrade.status !== 'partial_tp') {
            this.logger.debug(`[OnTriggerDetected] ${trade.id}: Cannot process TP, status is ${currentTrade.status}`);
            return;
          }

          const alreadyHit = currentTrade.tpsHit?.includes(tpIndex!);
          if (alreadyHit) {
            this.logger.debug(`[OnTriggerDetected] Trade ${trade.id} TP${tpIndex} already hit, ignoring`);
            return;
          }

          const tpsHit = [...(currentTrade.tpsHit || []), tpIndex!];
          const allTPHit = currentTrade.tps!.length === tpsHit.length;

          if (allTPHit) {
            await this.commandBus.execute(
              new TransitionStateCommand(trade.id, TradeStatus.CLOSED_WIN, 'all_tp_hit', { rr })
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
    } catch (error) {
      this.logger.error(`[OnTriggerDetected] Error processing ${trigger} for trade ${trade.id}: ${error}`);
    }
  }
}