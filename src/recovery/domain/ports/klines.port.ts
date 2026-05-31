export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

export interface KlinesPort {
  getKlines(
    symbol: string,
    interval: string,
    startTime: number,
    endTime: number,
    limit?: number,
  ): Promise<Kline[]>;
}