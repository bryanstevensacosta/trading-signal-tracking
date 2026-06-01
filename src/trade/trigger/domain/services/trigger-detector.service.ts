import { Injectable, Inject } from '@nestjs/common';
import { Trade, TradeSide, TriggerType, Price, OrderType } from '@trade/shared';
import { LoggerPort, LOGGER_PORT } from '../../../../shared/domain/ports/logger.port';

/**
 * Result of checking price triggers.
 */
export interface TriggerResult {
  triggered: boolean;
  trigger?: TriggerType;
  price?: number;
  tpIndex?: number;
  rr?: number;
  lastTpIndex?: number;
  nearEntry?: boolean;
  nearTP?: boolean;
  nearSL?: boolean;
}

/**
 * Domain service for detecting trade triggers.
 * Checks if entry, TP, SL, or breakeven prices are hit.
 * 
 * Logic for entry triggers:
 * - LONG/SPOT: Entry activates when price goes DOWN to entry (currentPrice <= entry)
 * - SHORT: Entry activates when price goes UP to entry (currentPrice >= entry)
 */
@Injectable()
export class TriggerDetectorService {
  constructor(@Inject(LOGGER_PORT) private readonly logger: LoggerPort) {}
  /**
   * Checks if entry price is hit for a pending trade.
   * Uses last price for simplicity.
   * 
   * MARKET order: activates immediately at current price
   * LIMIT order: waits for price to reach entry, fills at entry or better
   */
  checkEntryHit(trade: Trade, price: Price): TriggerResult {
    if (trade.status !== 'pending') {
      this.logger.debug(`[TriggerDetector] ${trade.symbol}: Skipping entry check, status is ${trade.status}`);
      return { triggered: false };
    }

    const currentPrice = price.last;
    this.logger.debug(`[TriggerDetector] ${trade.symbol}: Checking entry hit, currentPrice: ${currentPrice}, entry: ${trade.entry}, orderType: ${trade.orderType}, side: ${trade.side}`);

    // MARKET order - activates immediately
    if (trade.orderType === OrderType.MARKET) {
      this.logger.debug(`[TriggerDetector] ${trade.symbol}: MARKET order, triggering entry immediately`);
      return {
        triggered: true,
        trigger: TriggerType.ENTRY,
        price: currentPrice,
      };
    }

    // LIMIT order - check if price reached entry level
    const isHit = this.checkPriceReachedEntry(trade, currentPrice);
    this.logger.debug(`[TriggerDetector] ${trade.symbol}: LIMIT order, isHit: ${isHit}`);
    
    if (isHit) {
      this.logger.info(`[TriggerDetector] ${trade.symbol}: Entry HIT at ${currentPrice}`);
      return {
        triggered: true,
        trigger: TriggerType.ENTRY,
        price: currentPrice,
      };
    }

    // Check if price is near entry (for debug logging)
    const nearEntry = this.isNearEntry(trade, currentPrice);
    if (nearEntry) {
      this.logger.debug(`[TriggerDetector] ${trade.symbol}: Price is near entry, current: ${currentPrice}, entry: ${trade.entry}`);
      return { triggered: false, nearEntry: true };
    }

    return { triggered: false };
  }

  /**
   * Checks if price has reached the entry level (for LIMIT orders).
   * 
   * LONG/SPOT: Activates when price goes DOWN to entry (currentPrice <= entry)
   * SHORT: Entry activates when price goes UP to entry (currentPrice >= entry)
   */
  private checkPriceReachedEntry(trade: Trade, currentPrice: number): boolean {
    const entry = trade.entry;
    const entryMax = trade.entryMax;

    if (trade.side === TradeSide.LONG || trade.side === TradeSide.SPOT) {
      if (entryMax === null || entryMax === undefined) {
        return currentPrice <= entry;
      }
      return currentPrice >= entry && currentPrice <= entryMax;
    } else if (trade.side === TradeSide.SHORT) {
      if (entryMax === null || entryMax === undefined) {
        return currentPrice >= entry;
      }
      return currentPrice <= entry && currentPrice >= entryMax;
    }

    return false;
  }

  /**
   * Checks if any TP is hit.
   */
  checkTPHit(trade: Trade, price: Price): TriggerResult {
    if (trade.status !== 'active' && trade.status !== 'partial_tp') {
      this.logger.debug(`[TriggerDetector] ${trade.symbol}: Skipping TP check, status is ${trade.status}`);
      return { triggered: false };
    }

    if (!trade.tps || trade.tps.length === 0) {
      this.logger.debug(`[TriggerDetector] ${trade.symbol}: No TPs configured`);
      return { triggered: false };
    }

    if (!price || (price.bid == null && price.ask == null)) {
      this.logger.debug(`[TriggerDetector] ${trade.symbol}: No valid price (bid: ${price?.bid}, ask: ${price?.ask})`);
      return { triggered: false };
    }

    const isLongOrSpot = trade.side === TradeSide.LONG || trade.side === TradeSide.SPOT;
    const currentPrice = isLongOrSpot ? price.bid : price.ask;
    
    this.logger.debug(`[TriggerDetector] ${trade.symbol}: Checking TP hit, status: ${trade.status}, currentPrice: ${currentPrice}, TPs: ${trade.tps.join(', ')}, tpsHit: ${trade.tpsHit}`);

    for (let i = 0; i < trade.tps.length; i++) {
      const tp = trade.tps[i];
      if (trade.tpsHit?.includes(i)) {
        this.logger.debug(`[TriggerDetector] ${trade.symbol}: TP${i + 1} already hit, skipping`);
        continue;
      }

      const isHit = isLongOrSpot
        ? currentPrice >= tp
        : currentPrice <= tp;

      this.logger.debug(`[TriggerDetector] ${trade.symbol}: TP${i + 1} (${tp}), isHit: ${isHit}`);

      if (isHit) {
        this.logger.info(`[TriggerDetector] ${trade.symbol}: TP${i + 1} HIT at ${currentPrice} (target: ${tp})`);
        const rr = trade.sl
          ? Math.abs(tp - trade.entry) / Math.abs(trade.entry - trade.sl)
          : undefined;

        return {
          triggered: true,
          trigger: TriggerType.TP,
          price: tp,
          rr,
          tpIndex: i,
        };
      }
    }

    // Check if price is at TP level (for debug logging)
    if (this.isNearTP(trade, currentPrice)) {
      this.logger.debug(`[TriggerDetector] ${trade.symbol}: Price is near TP, current: ${currentPrice}`);
      return { triggered: false, nearTP: true };
    }

    return { triggered: false };
  }

  /**
   * Checks if SL is hit.
   */
  checkSLHit(trade: Trade, price: Price): TriggerResult {
    if (!trade.sl) {
      return { triggered: false };
    }

    if (!price || (price.bid == null && price.ask == null)) {
      return { triggered: false };
    }

    const isLongOrSpot = trade.side === TradeSide.LONG || trade.side === TradeSide.SPOT;
    const currentPrice = isLongOrSpot ? price.bid : price.ask;

    const isHit = isLongOrSpot
      ? currentPrice <= trade.sl
      : currentPrice >= trade.sl;

    if (isHit) {
      const lastTpIndex = trade.tpsHit && trade.tpsHit.length > 0
        ? trade.tpsHit[trade.tpsHit.length - 1]
        : undefined;

      return {
        triggered: true,
        trigger: TriggerType.SL,
        price: trade.sl,
        rr: -1,
        lastTpIndex,
      };
    }

    // Check if price is near SL (for debug logging)
    if (this.isNearSL(trade, currentPrice)) {
      return { triggered: false, nearSL: true };
    }

    return { triggered: false };
  }

  /**
   * Checks all triggers in priority order: entry, TP, SL.
   */
  checkAllTriggers(trade: Trade, price: Price): TriggerResult {
    const entryResult = this.checkEntryHit(trade, price);
    if (entryResult.triggered) return entryResult;

    const tpResult = this.checkTPHit(trade, price);
    if (tpResult.triggered) return tpResult;

    const slResult = this.checkSLHit(trade, price);
    if (slResult.triggered) return slResult;

    return { triggered: false };
  }

  /**
   * Calculates risk/reward ratio.
   */
  private calculateRR(entry: number, sl: number, tp: number, side: TradeSide): number {
    const r = Math.abs(entry - sl);
    if (r === 0) return 0;

    const reward = Math.abs(tp - entry);
    const rr = reward / r;

    return side === TradeSide.SHORT ? -rr : rr;
  }

  /**
   * Checks if price is within 1% of entry level.
   */
  private isNearEntry(trade: Trade, currentPrice: number): boolean {
    const entry = trade.entry;
    const threshold = entry * 0.01;

    if (trade.side === TradeSide.LONG || trade.side === TradeSide.SPOT) {
      return Math.abs(currentPrice - entry) <= threshold;
    } else if (trade.side === TradeSide.SHORT) {
      return Math.abs(currentPrice - entry) <= threshold;
    }
    return false;
  }

  /**
   * Checks if price is within 1% of any TP level.
   */
  private isNearTP(trade: Trade, currentPrice: number): boolean {
    if (!trade.tps || trade.tps.length === 0) return false;

    for (const tp of trade.tps) {
      const threshold = tp * 0.01;
      if (Math.abs(currentPrice - tp) <= threshold) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks if price is within 1% of SL level.
   */
  private isNearSL(trade: Trade, currentPrice: number): boolean {
    if (!trade.sl) return false;

    const threshold = trade.sl * 0.01;
    return Math.abs(currentPrice - trade.sl) <= threshold;
  }

  /**
   * Checks if entry is already hit at current price.
   * Used to detect "instant active" trades when price is already in range.
   */
  isEntryAlreadyHit(trade: Trade, currentPrice: number): boolean {
    if (trade.status !== 'pending') {
      return false;
    }

    if (trade.orderType === OrderType.MARKET) {
      return true;
    }

    return this.checkPriceReachedEntry(trade, currentPrice);
  }

  /**
   * Gets the executed entry price if entry is hit at current price.
   * Returns null if entry is not yet hit.
   * 
   * For MARKET orders: returns currentPrice (execution at market)
   * For LIMIT orders: returns trade.entry (execution at limit price)
   */
  getExecutedEntryPrice(trade: Trade, currentPrice: number): number | null {
    if (!this.isEntryAlreadyHit(trade, currentPrice)) {
      return null;
    }

    if (trade.orderType === OrderType.MARKET) {
      return currentPrice;
    }

    return trade.entry;
  }
}