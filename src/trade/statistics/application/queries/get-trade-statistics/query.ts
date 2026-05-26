import { IQuery } from '@nestjs/cqrs';

export class GetTradeStatisticsQuery implements IQuery {
  constructor(
    public readonly fromDate?: Date,
    public readonly toDate?: Date,
    public readonly symbols?: string[],
  ) {}
}