import { Price } from '@trade/shared';

/**
 * DTO for requesting current price of a symbol.
 */
export interface GetPriceDto {
  symbol: string;
}

/**
 * DTO for price query result.
 */
export interface GetPriceResultDto {
  price: Price;
}