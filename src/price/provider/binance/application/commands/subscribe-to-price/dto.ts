import { Price } from '@trade/shared';

export interface SubscribeToPriceDto {
  symbol: string;
}

export interface SubscribeToPriceResultDto {
  unsubscribe: () => void;
}

export interface PriceUpdateEvent {
  symbol: string;
  price: Price;
}

export interface SubscribeToMultiplePricesDto {
  symbols: string[];
}

export interface SubscribeToMultiplePricesResultDto {
  unsubscribe: () => void;
}