import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PositionPnlService } from './position-pnl/domain/services/position-pnl.service';
import { CanvasPositionPnlAdapter } from './position-pnl/infrastructure/adapters/canvas-position-pnl.adapter';
import { GeneratePositionPnlHandler } from './position-pnl/application/commands/generate-position-pnl/handler';
import { AccountPnlService } from './account-pnl/domain/services/account-pnl.service';
import { CanvasAccountPnlAdapter } from './account-pnl/infrastructure/adapters/canvas-account-pnl.adapter';
import { GenerateAccountPnlHandler } from './account-pnl/application/commands/generate-account-pnl/handler';
import { TradeRepositoryModule } from '@trade/repository/trade-repository.module';
import { PriceCacheModule } from '@price/cache/price-cache.module';

const PositionPnlCommandHandlers = [GeneratePositionPnlHandler];
const AccountPnlCommandHandlers = [GenerateAccountPnlHandler];

@Module({
  imports: [
    CqrsModule,
    forwardRef(() => TradeRepositoryModule),
    forwardRef(() => PriceCacheModule),
  ],
  providers: [
    PositionPnlService,
    CanvasPositionPnlAdapter,
    ...PositionPnlCommandHandlers,
    AccountPnlService,
    CanvasAccountPnlAdapter,
    ...AccountPnlCommandHandlers,
  ],
  exports: [
    PositionPnlService,
    CanvasPositionPnlAdapter,
    AccountPnlService,
    CanvasAccountPnlAdapter,
  ],
})
export class ShareCardModule {}