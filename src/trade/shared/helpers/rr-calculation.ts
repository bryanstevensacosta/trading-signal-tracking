import { TradeSide } from '../types';

/**
 * Calculates the risk (R) in absolute terms.
 * @param entry - Entry price
 * @param sl - Stop loss price
 * @returns Absolute risk value
 */
export function calculateR(entry: number, sl: number): number {
  return Math.abs(entry - sl);
}

/**
 * Calculates Risk:Reward ratio for a trade.
 * @param entry - Entry price
 * @param sl - Stop loss price
 * @param tp - Take profit price
 * @param side - Trade direction
 * @returns RR ratio (negative for SHORT trades)
 */
export function calculateRR(
  entry: number,
  sl: number,
  tp: number,
  side: TradeSide
): number {
  const r = calculateR(entry, sl);
  if (r === 0) return 0;

  const reward = Math.abs(tp - entry);
  const rr = reward / r;

  if (side === TradeSide.SHORT) {
    return -rr;
  }

  return rr;
}

/**
 * Calculates RR ratios for multiple take profit levels.
 * @param entry - Entry price
 * @param sl - Stop loss price
 * @param tps - Array of take profit prices
 * @param side - Trade direction
 * @returns Array of RR ratios
 */
export function calculateMultipleRR(
  entry: number,
  sl: number,
  tps: number[],
  side: TradeSide
): number[] {
  return tps.map((tp) => calculateRR(entry, sl, tp, side));
}

/**
 * Calculates profit/loss in absolute terms.
 * @param entry - Entry price
 * @param closePrice - Closing price
 * @param side - Trade direction
 * @returns PnL value
 */
export function calculatePnL(
  entry: number,
  closePrice: number,
  side: TradeSide
): number {
  if (side === TradeSide.LONG || side === TradeSide.SPOT) {
    return closePrice - entry;
  }
  return entry - closePrice;
}

/**
 * Calculates profit/loss as percentage.
 * @param entry - Entry price
 * @param closePrice - Closing price
 * @param side - Trade direction
 * @returns PnL percentage
 */
export function calculatePnLPercent(
  entry: number,
  closePrice: number,
  side: TradeSide
): number {
  const pnl = calculatePnL(entry, closePrice, side);
  return (pnl / entry) * 100;
}