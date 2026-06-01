import { TradeSide } from '@trade/shared';

/**
 * Returns emoji for trade side.
 * 
 * @param side - Trade side (LONG, SHORT, SPOT)
 * @returns Emoji representation
 * 
 * @example
 * formatSideEmoji('LONG') // '🟢'
 * formatSideEmoji('SHORT') // '🔴'
 * formatSideEmoji('SPOT') // '⚪'
 */
export function formatSideEmoji(side: TradeSide | string): string {
  return side === 'LONG' ? '🟢' : side === 'SHORT' ? '🔴' : '🔵';
}