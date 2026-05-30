/**
 * Formats take profit levels as a string.
 * 
 * @param tps - Array of TP levels
 * @param tpsHit - Array of TP indices that have been hit (optional)
 * @returns Formatted TP string
 * 
 * @example
 * formatTps([50000, 51000, 52000]) // '50000 / 51000 / 52000'
 * formatTps([50000, 51000], [1]) // '50000 / ✅51000'
 */
export function formatTps(tps: number[], tpsHit?: number[]): string {
  if (!tps || tps.length === 0) return '';
  
  if (!tpsHit || tpsHit.length === 0) {
    return tps.join(' / ');
  }
  
  return tps.map((tp, i) => {
    const hit = tpsHit.includes(i);
    return hit ? `✅${tp}` : tp.toString();
  }).join(' / ');
}