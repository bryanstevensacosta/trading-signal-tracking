import { Injectable } from '@nestjs/common';
import { Trade, TradeSide, TriggerType, Price, OrderType } from '@trade/shared';

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
  /**
   * Checks if entry price is hit for a pending trade.
   * Uses last price for simplicity.
   * 
   * MARKET order: activates immediately at current price
   * LIMIT order: waits for price to reach entry, fills at entry or better
   */
  checkEntryHit(trade: Trade, price: Price): TriggerResult {
    if (trade.status !== 'pending') {
      return { triggered: false };
    }

    const currentPrice = price.last;

    // MARKET order - activates immediately
    if (trade.orderType === OrderType.MARKET) {
      return {
        triggered: true,
        trigger: TriggerType.ENTRY,
        price: currentPrice,
      };
    }

    // LIMIT order - check if price reached entry level
    const isHit = this.checkPriceReachedEntry(trade, currentPrice);
    if (isHit) {
      return {
        triggered: true,
        trigger: TriggerType.ENTRY,
        price: currentPrice,
      };
    }

    return { triggered: false };
  }

  /**
   * Checks if price has reached the entry level (for LIMIT orders).
   * 
   * LONG/SPOT: Activates when price goes DOWN to entry (currentPrice <= entry)
   * SHORT: Activates when price goes UP to entry (currentPrice >= entry)
   */
  private checkPriceReachedEntry(trade: Trade, currentPrice: number): boolean {
    const entry = trade.entry;
    const entryMax = trade.entryMax || entry;

    if (trade.side === TradeSide.LONG || trade.side === TradeSide.SPOT) {
      return currentPrice <= entry && currentPrice >= entryMax;
    } else if (trade.side === TradeSide.SHORT) {
      return currentPrice >= entry && currentPrice <= entryMax;
    }

    return false;
  }

  /**
   * Checks if any TP is hit.
   */
  checkTPHit(trade: Trade, price: Price): TriggerResult {
    if (!trade.tps || trade.tps.length === 0) {
      return { triggered: false };
    }

    if (!price || (price.bid == null && price.ask == null)) {
      return { triggered: false };
    }

    const isLongOrSpot = trade.side === TradeSide.LONG || trade.side === TradeSide.SPOT;
    const currentPrice = isLongOrSpot ? price.bid : price.ask;

    for (let i = 0; i < trade.tps.length; i++) {
      const tp = trade.tps[i];
      if (trade.tpsHit?.includes(i)) continue;

      const isHit = isLongOrSpot
        ? currentPrice >= tp
        : currentPrice <= tp;

      if (isHit) {
        const rr = trade.sl
          ? this.calculateRR(trade.entry, trade.sl, tp, trade.side)
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
}