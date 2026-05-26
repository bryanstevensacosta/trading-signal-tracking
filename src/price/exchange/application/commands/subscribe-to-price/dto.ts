import { Price } from '@trade/shared';

/**
 * DTO for subscribing to real-time price updates.
 */
export interface SubscribeToPriceDto {
  symbol: string;
}

/**
 * DTO for real-time price subscription result.
 */
export interface SubscribeToPriceResultDto {
  unsubscribe: () => void;
}

/**
 * Event payload for price updates.
 */
export interface PriceUpdateEvent {
  symbol: string;
  price: Price;
}

/**
 * DTO for batch subscription to multiple symbols.
 */
export interface SubscribeToMultiplePricesDto {
  symbols: string[];
}

/**
 * DTO for batch subscription result.
 */
export interface SubscribeToMultiplePricesResultDto {
  unsubscribe: () => void;
}