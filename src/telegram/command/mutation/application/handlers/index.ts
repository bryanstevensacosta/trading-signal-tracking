import { CancelTradeHandler } from './cancel-trade.handler';
import { DeleteTradeHandler } from './delete-trade.handler';
import { ModifyEntryHandler } from './modify-entry.handler';
import { ModifySLHandler } from './modify-sl.handler';
import { ModifyTPHandler } from './modify-tp.handler';
import { CloseTradeHandler } from './close-trade.handler';
import { MoveToBreakevenHandler } from './move-to-breakeven.handler';
import { ForceOpenHandler } from './force-open.handler';
import { CleanDatabaseHandler } from './clean-database.handler';

export const MutationHandlers = [
  CancelTradeHandler,
  DeleteTradeHandler,
  ModifyEntryHandler,
  ModifySLHandler,
  ModifyTPHandler,
  CloseTradeHandler,
  MoveToBreakevenHandler,
  ForceOpenHandler,
  CleanDatabaseHandler,
];

export {
  CancelTradeHandler,
  DeleteTradeHandler,
  ModifyEntryHandler,
  ModifySLHandler,
  ModifyTPHandler,
  CloseTradeHandler,
  MoveToBreakevenHandler,
  ForceOpenHandler,
  CleanDatabaseHandler,
};