/**
 * Query to get current price for a trading symbol.
 */
export class GetPriceQuery {
  constructor(public readonly symbol: string) {}
}