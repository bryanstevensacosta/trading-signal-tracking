import { Injectable, Inject } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { Trade, TradeSide, TradeStatus } from '@trade/shared';
import { TriggerType } from '@trade/shared/types/trigger';
import { TRADE_REPOSITORY_PORT, TradeRepositoryPort } from '@trade/repository/domain/ports/trade-repository.port';
import { SPOT_PORT, FUTURES_PORT } from '@price/provider/binance/tokens';
import type { BinanceSpotPort } from '@price/provider/binance/domain/ports/binance-spot.port';
import type { BinanceFuturesPort } from '@price/provider/binance/domain/ports/binance-futures.port';
import { TriggerDetectorService, TriggerResult } from '@trade/trigger/domain/services/trigger-detector.service';
import { TriggerDetectedEvent } from '@trade/trigger/domain/events/trigger-detected.event';
import { LoggerPort, LOGGER_PORT } from '@shared/domain/ports/logger.port';
import { TELEGRAM_NOTIFICATION_LOG_PORT, TelegramNotificationLogPort } from '@telegram/notification/shared/domain/ports/telegram-notification-log.port';
import { RecoveryEnginePort, RecoveryResult } from '../ports/recovery-engine.port';
import { Kline } from '../ports/klines.port';

@Injectable()
export class RecoveryOrchestratorService implements RecoveryEnginePort {
  private readonly logger: LoggerPort;

  constructor(
    @Inject(TRADE_REPOSITORY_PORT) private readonly tradeRepository: TradeRepositoryPort,
    @Inject(SPOT_PORT) private readonly spotExchange: BinanceSpotPort,
    @Inject(FUTURES_PORT) private readonly futuresExchange: BinanceFuturesPort,
    private readonly triggerDetector: TriggerDetectorService,
    private readonly eventBus: EventBus,
    @Inject(TELEGRAM_NOTIFICATION_LOG_PORT) private readonly notificationLog: TelegramNotificationLogPort,
    @Inject(LOGGER_PORT) logger: LoggerPort,
  ) {
    this.logger = logger;
  }

  private getExchange(side: TradeSide): BinanceSpotPort | BinanceFuturesPort {
    return side === TradeSide.SPOT ? this.spotExchange : this.futuresExchange;
  }

  async recoverMissedTriggers(): Promise<RecoveryResult> {
    const startTime = Date.now();
    const results = new Map<string, TriggerResult>();
    let fixedStates = 0;

    this.logger.info('[Recovery] Starting recovery process...');

    const pendingTrades = await this.tradeRepository.findPending();
    this.logger.info(`[Recovery] Checking ${pendingTrades.length} pending trades`);

    for (const trade of pendingTrades) {
      this.logger.info(`[Recovery] ${trade.symbol}: status=${trade.status}, entryExecutedAt=${trade.entryExecutedAt}, entryExecutedPrice=${trade.entryExecutedPrice}, entry=${trade.entry}`);
    }

    const fixedTradeIds = new Set<string>();

    for (const trade of pendingTrades) {
      if (trade.entryExecutedAt && trade.status === TradeStatus.PENDING) {
        this.logger.info(`[Recovery] ${trade.symbol}: Fixing inconsistent state - entry executed but status is pending`);
        await this.tradeRepository.update(trade.id, { status: TradeStatus.ACTIVE });
        fixedStates++;
        fixedTradeIds.add(trade.id);
      }
    }

    for (const trade of pendingTrades) {
      const hasEntryExecuted = trade.entryExecutedAt != null;
      const wasFixed = fixedTradeIds.has(trade.id);
      
      this.logger.info(`[Recovery] ${trade.symbol}: processing - hasEntryExecuted=${hasEntryExecuted}, wasFixed=${wasFixed}, status=${trade.status}`);
      
      if (wasFixed) {
        this.logger.info(`[Recovery] ${trade.symbol}: Entry was already executed (entryExecutedAt set), publishing ENTRY trigger`);
        
        const alreadyNotified = await this.wasNotificationSent(trade.id, 'entry', undefined);
        if (!alreadyNotified) {
          const freshTrade = await this.tradeRepository.findById(trade.id);
          await this.eventBus.publish(new TriggerDetectedEvent(freshTrade!, TriggerType.ENTRY, trade.entryExecutedPrice || trade.entry));
          this.logger.info(`[Recovery] ${trade.symbol}: Published ENTRY trigger event`);
        } else {
          this.logger.info(`[Recovery] ${trade.symbol}: ENTRY notification already sent, skipping`);
        }
        
        const tpResult = await this.checkActiveTradeForMissedTriggers(trade);
        if (tpResult.triggered && tpResult.trigger && tpResult.price != null) {
          results.set(trade.id, tpResult);
          this.logger.info(`[Recovery] ${trade.symbol}: TP trigger detected at ${tpResult.price}`);
          
          const alreadyNotifiedTp = await this.wasNotificationSent(trade.id, tpResult.trigger, tpResult.tpIndex);
          if (alreadyNotifiedTp) {
            this.logger.info(`[Recovery] ${trade.symbol}: TP notification already sent, skipping`);
            continue;
          }
          
          const freshTrade = await this.tradeRepository.findById(trade.id);
          await this.eventBus.publish(new TriggerDetectedEvent(freshTrade!, tpResult.trigger, tpResult.price, tpResult.rr, tpResult.tpIndex, tpResult.lastTpIndex));
          this.logger.info(`[Recovery] ${trade.symbol}: Published ${tpResult.trigger} trigger event`);
        }
      } else {
        const result = await this.checkTradeForMissedTriggers(trade);

        if (result.triggered && result.trigger && result.price != null) {
          results.set(trade.id, result);
          this.logger.info(`[Recovery] ${trade.symbol}: ${result.trigger} trigger detected at ${result.price}`);

          const alreadyNotified = await this.wasNotificationSent(trade.id, result.trigger, result.tpIndex);
          if (alreadyNotified) {
            this.logger.info(`[Recovery] Notification already sent for ${trade.id}, skipping`);
            continue;
          }

          const freshTrade = await this.tradeRepository.findById(trade.id);
          await this.eventBus.publish(
            new TriggerDetectedEvent(
              freshTrade!,
              result.trigger,
              result.price,
              result.rr,
              result.tpIndex,
              result.lastTpIndex,
            ),
          );
          this.logger.info(`[Recovery] Published TriggerDetectedEvent for trade ${trade.id}`);
          
          if (result.trigger === 'entry') {
            await new Promise(resolve => setTimeout(resolve, 500));
            const updatedTrade = await this.tradeRepository.findById(trade.id);
            this.logger.info(`[Recovery] ${trade.symbol}: After entry, trade is now ${updatedTrade?.status}, entryExecutedAt=${updatedTrade?.entryExecutedAt}, lastSeenTimestamp=${updatedTrade?.lastSeenTimestamp}`);
            
            const klinesStartTime = updatedTrade?.entryExecutedAt 
              ? updatedTrade.entryExecutedAt.getTime()
              : updatedTrade!.createdAt.getTime();
            this.logger.info(`[Recovery] ${trade.symbol}: Would check TP from ${new Date(klinesStartTime).toISOString()} to now (${new Date().toISOString()})`);
            if (updatedTrade?.status === 'active' && updatedTrade?.entryExecutedAt) {
              this.logger.info(`[Recovery] ${trade.symbol}: Checking TP after entry trigger...`);
              const tpResult = await this.checkActiveTradeForMissedTriggers(updatedTrade);
              this.logger.info(`[Recovery] ${trade.symbol}: TP check result: triggered=${tpResult.triggered}, trigger=${tpResult.trigger}`);
              if (tpResult.triggered && tpResult.trigger && tpResult.price != null) {
                results.set(trade.id, tpResult);
                const alreadyNotifiedTp = await this.wasNotificationSent(trade.id, tpResult.trigger, tpResult.tpIndex);
                if (!alreadyNotifiedTp) {
                  const freshTrade = await this.tradeRepository.findById(trade.id);
                  await this.eventBus.publish(new TriggerDetectedEvent(freshTrade!, tpResult.trigger, tpResult.price, tpResult.rr, tpResult.tpIndex, tpResult.lastTpIndex));
                  this.logger.info(`[Recovery] ${trade.symbol}: Published TP trigger event`);
                }
              }
            }
          }
        } else if (hasEntryExecuted) {
          const tpResult = await this.checkActiveTradeForMissedTriggers(trade);
          
          if (tpResult.triggered && tpResult.trigger && tpResult.price != null) {
            results.set(trade.id, tpResult);
            this.logger.info(`[Recovery] ${trade.symbol}: TP trigger detected at ${tpResult.price}`);
            
            const alreadyNotified = await this.wasNotificationSent(trade.id, tpResult.trigger, tpResult.tpIndex);
            if (alreadyNotified) {
              continue;
            }
            
            const freshTrade = await this.tradeRepository.findById(trade.id);
            await this.eventBus.publish(
              new TriggerDetectedEvent(
                freshTrade!,
                tpResult.trigger,
                tpResult.price,
                tpResult.rr,
                tpResult.tpIndex,
                tpResult.lastTpIndex,
              ),
            );
          }
        }
      }
    }

    const activeTrades = await this.tradeRepository.findByStatus('active');
    for (const trade of activeTrades) {
      const result = await this.checkActiveTradeForMissedTriggers(trade);

      if (result.triggered && result.trigger && result.price != null) {
        results.set(trade.id, result);
        this.logger.info(`[Recovery] ${trade.symbol}: ${result.trigger} trigger detected`);

        const alreadyNotified = await this.wasNotificationSent(trade.id, result.trigger, result.tpIndex);
        if (alreadyNotified) {
          continue;
        }

        await this.eventBus.publish(
          new TriggerDetectedEvent(
            trade,
            result.trigger,
            result.price,
            result.rr,
            result.tpIndex,
            result.lastTpIndex,
          ),
        );
      }
    }

    const partialTpTrades = await this.tradeRepository.findByStatus('partial_tp');
    for (const trade of partialTpTrades) {
      const result = await this.checkActiveTradeForMissedTriggers(trade);

      if (result.triggered && result.trigger && result.price != null) {
        results.set(trade.id, result);
        this.logger.info(`[Recovery] ${trade.symbol}: ${result.trigger} trigger detected`);

        const alreadyNotified = await this.wasNotificationSent(trade.id, result.trigger, result.tpIndex);
        if (alreadyNotified) {
          continue;
        }

        await this.eventBus.publish(
          new TriggerDetectedEvent(
            trade,
            result.trigger,
            result.price,
            result.rr,
            result.tpIndex,
            result.lastTpIndex,
          ),
        );
      }
    }

    const duration = Date.now() - startTime;
    this.logger.info(`[Recovery] Completed. Fixed ${fixedStates} states, detected ${results.size} triggers, took ${duration}ms`);

    return { triggers: results, fixedStates, duration };
  }

  private async checkTradeForMissedTriggers(trade: Trade): Promise<TriggerResult> {
    if (trade.status !== 'pending') {
      return { triggered: false };
    }

    if (trade.entryExecutedAt) {
      return { triggered: false };
    }

    const startTime = trade.lastSeenTimestamp
      ? trade.lastSeenTimestamp.getTime()
      : trade.createdAt.getTime();
    const endTime = Date.now();

    const exchange = this.getExchange(trade.side);

    try {
      const klines = await exchange.getKlines(
        trade.symbol,
        '1m',
        startTime,
        endTime,
        1440
      );

      if (!klines || klines.length === 0) {
        return { triggered: false };
      }

      return this.checkKlinesForEntryHit(trade, klines);
    } catch (error) {
      this.logger.error(`[Recovery] Failed to get klines for ${trade.symbol}: ${error}`);
      return { triggered: false };
    }
  }

  private checkKlinesForEntryHit(trade: Trade, klines: Kline[]): TriggerResult {
    const entry = trade.entry;

    for (const candle of klines) {
      if (trade.side === TradeSide.LONG || trade.side === TradeSide.SPOT) {
        if (candle.low <= entry) {
          this.logger.info(`[Recovery] ${trade.symbol}: Entry hit at ${entry} (candle low: ${candle.low})`);
          return {
            triggered: true,
            trigger: TriggerType.ENTRY,
            price: entry,
          };
        }
      } else if (trade.side === TradeSide.SHORT) {
        if (candle.high >= entry) {
          this.logger.info(`[Recovery] ${trade.symbol}: Entry hit at ${entry} (candle high: ${candle.high})`);
          return {
            triggered: true,
            trigger: TriggerType.ENTRY,
            price: entry,
          };
        }
      }
    }

    return { triggered: false };
  }

  private async checkActiveTradeForMissedTriggers(trade: Trade): Promise<TriggerResult> {
    const isValidStatus = trade.status === 'active' || trade.status === 'partial_tp' || 
                          (trade.status === 'pending' && trade.entryExecutedAt);
    
    if (!isValidStatus) {
      return { triggered: false };
    }

    if (!trade.entryExecutedAt) {
      return { triggered: false };
    }

    const startTime = trade.entryExecutedAt
      ? trade.entryExecutedAt.getTime()
      : trade.createdAt.getTime();
    const endTime = Date.now();

    const exchange = this.getExchange(trade.side);

    try {
      const klines = await exchange.getKlines(
        trade.symbol,
        '1m',
        startTime,
        endTime,
        1440
      );

      if (!klines || klines.length === 0) {
        return { triggered: false };
      }

      return this.checkKlinesForTPAndSLHit(trade, klines);
    } catch (error) {
      this.logger.error(`[Recovery] Failed to get klines for ${trade.symbol}: ${error}`);
      return { triggered: false };
    }
  }

  private checkKlinesForTPAndSLHit(trade: Trade, klines: Kline[]): TriggerResult {
    const highs = klines.map(k => k.high);
    const lows = klines.map(k => k.low);

    if (trade.tps && trade.tps.length > 0) {
      for (let i = 0; i < trade.tps.length; i++) {
        const tp = trade.tps[i];
        const tpHit = trade.tpsHit?.includes(i);

        if (tpHit) continue;

        if (trade.side === TradeSide.LONG || trade.side === TradeSide.SPOT) {
          if (highs.some(h => h >= tp)) {
            return {
              triggered: true,
              trigger: TriggerType.TP,
              price: tp,
              tpIndex: i,
              lastTpIndex: trade.tps.length - 1,
            };
          }
        } else {
          if (lows.some(l => l <= tp)) {
            return {
              triggered: true,
              trigger: TriggerType.TP,
              price: tp,
              tpIndex: i,
              lastTpIndex: trade.tps.length - 1,
            };
          }
        }
      }
    }

    if (trade.sl) {
      if (trade.side === TradeSide.LONG || trade.side === TradeSide.SPOT) {
        if (lows.some(l => l <= trade.sl!)) {
          return {
            triggered: true,
            trigger: TriggerType.SL,
            price: trade.sl,
          };
        }
      } else {
        if (highs.some(h => h >= trade.sl!)) {
          return {
            triggered: true,
            trigger: TriggerType.SL,
            price: trade.sl,
          };
        }
      }
    }

    return { triggered: false };
  }

  private async wasNotificationSent(tradeId: string, trigger: string, tpIndex?: number): Promise<boolean> {
    try {
      const logs = await this.notificationLog.getForTrade(tradeId);
      return logs.some((log: { type: string; tpIndex: number | null }) => log.type === trigger && (tpIndex === undefined || log.tpIndex === tpIndex));
    } catch {
      return false;
    }
  }
}