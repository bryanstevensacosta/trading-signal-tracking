import { Price } from '@trade/shared';

export class SubscribeToPriceCommand {
  constructor(
    public readonly symbol: string,
    public readonly onPriceUpdate: (price: Price) => void,
  ) {}
}

export class SubscribeToMultiplePricesCommand {
  constructor(
    public readonly symbols: string[],
    public readonly onPriceUpdate: (prices: Price[]) => void,
  ) {}
}