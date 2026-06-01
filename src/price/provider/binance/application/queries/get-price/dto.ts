import { Price } from '@trade/shared';

export interface GetPriceDto {
  symbol: string;
}

export interface GetPriceResultDto {
  price: Price;
}