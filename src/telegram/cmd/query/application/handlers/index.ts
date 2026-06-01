import { StartHandler } from './start.handler';
import { HelpHandler } from './help.handler';
import { GetTradesHandler } from './get-trades.handler';
import { GetActiveTradesHandler } from './get-active-trades.handler';
import { GetTradeByIdHandler } from './get-trade-by-id.handler';
import { GetStatsHandler } from './get-stats.handler';
import { GetShareCardPositionPnlHandler } from './get-card-position-pnl.handler';
import { GetShareCardAccountPnlHandler } from './get-card-account-pnl.handler';

export const QueryHandlers = [
  StartHandler,
  HelpHandler,
  GetTradesHandler,
  GetActiveTradesHandler,
  GetTradeByIdHandler,
  GetStatsHandler,
  GetShareCardPositionPnlHandler,
  GetShareCardAccountPnlHandler,
];

export {
  StartHandler,
  HelpHandler,
  GetTradesHandler,
  GetActiveTradesHandler,
  GetTradeByIdHandler,
  GetStatsHandler,
  GetShareCardPositionPnlHandler,
  GetShareCardAccountPnlHandler,
};