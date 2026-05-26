import { IQuery } from '@nestjs/cqrs';
import { HistoryFilters } from '../../../domain/ports/trade-history.port';

export class GetClosedTradesQuery implements IQuery {
  constructor(
    public readonly filters?: HistoryFilters,
    public readonly includeStats: boolean = false,
  ) {}
}