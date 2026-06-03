import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetTradesForSelectionQuery } from './GetTradesForSelectionQuery';
import { TRADE_REPOSITORY_PORT, TradeRepositoryPort } from '../../../domain/ports/trade-repository.port';
import { Trade, TradeStatus } from '@trade/shared';

export interface GetTradesForSelectionResult {
  trades: Trade[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@QueryHandler(GetTradesForSelectionQuery)
export class GetTradesForSelectionHandler implements IQueryHandler<GetTradesForSelectionQuery> {
  constructor(
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
  ) {}

  async execute(query: GetTradesForSelectionQuery): Promise<GetTradesForSelectionResult> {
    const { page, pageSize } = query;

    const activeTrades = await this.repository.findActive();
    const pendingTrades = await this.repository.findPending();

    const allTrades = [...pendingTrades, ...activeTrades].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const filteredTrades = allTrades.filter(t =>
      t.status === TradeStatus.PENDING ||
      t.status === TradeStatus.ACTIVE ||
      t.status === TradeStatus.PARTIAL_TP
    );

    const total = filteredTrades.length;
    const totalPages = Math.ceil(total / pageSize);

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageTrades = filteredTrades.slice(startIndex, endIndex);

    return {
      trades: pageTrades,
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}