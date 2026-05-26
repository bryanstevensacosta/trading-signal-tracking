import { Price } from '@trade/shared';

/**
 * Command to subscribe to real-time price updates for a single symbol.
 */
export class SubscribeToPriceCommand {
  constructor(
    public readonly symbol: string,
    public readonly onPriceUpdate: (price: Price) => void,
  ) {}
}

/**
 * Command to subscribe to real-time price updates for multiple symbols.
 */
export class SubscribeToMultiplePricesCommand {
  constructor(
    public readonly symbols: string[],
    public readonly onPriceUpdate: (prices: Price[]) => void,
  ) {}
}