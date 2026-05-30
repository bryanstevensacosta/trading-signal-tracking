import { TradeSide } from '@trade/shared';

/**
 * Returns type label for trade (FUTURES LONG, FUTURES SHORT, SPOT BUY).
 * 
 * @param side - Trade side
 * @returns Type label string
 * 
 * @example
 * formatTypeLabel('LONG') // 'FUTURES LONG'
 * formatTypeLabel('SHORT') // 'FUTURES SHORT'
 * formatTypeLabel('SPOT') // 'SPOT BUY'
 */
export function formatTypeLabel(side: TradeSide | string): string {
  return side === 'SPOT' ? 'SPOT BUY' : `FUTURES ${side}`;
}