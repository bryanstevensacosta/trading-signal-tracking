import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GeneratePositionPnlCommand } from './command';
import { PositionPnlService } from '@trade/share-card/position-pnl/domain/services/position-pnl.service';
import { CanvasPositionPnlAdapter } from '@trade/share-card/position-pnl/infrastructure/adapters/canvas-position-pnl.adapter';
import { DARK_THEME, LIGHT_THEME } from '@trade/share-card/common/constants';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '@trade/repository/domain/ports';
import { GetPriceQuery } from '@price/cache/application/queries/get-price/query';
import { Price } from '@trade/shared/types/price';

export class GeneratePositionPnlCommandResponse {
  constructor(
    public readonly buffer: Buffer,
    public readonly format: string,
    public readonly width: number,
    public readonly height: number,
  ) {}
}

@CommandHandler(GeneratePositionPnlCommand)
export class GeneratePositionPnlHandler
  implements ICommandHandler<GeneratePositionPnlCommand>
{
  constructor(
    private readonly positionPnlService: PositionPnlService,
    private readonly canvasAdapter: CanvasPositionPnlAdapter,
    @Inject(TRADE_REPOSITORY_PORT) private readonly tradeRepository: TradeRepositoryPort,
    private readonly queryBus: QueryBus,
  ) {}

  async execute(
    command: GeneratePositionPnlCommand,
  ): Promise<GeneratePositionPnlCommandResponse> {
    const trade = await this.tradeRepository.findById(command.tradeId);

    if (!trade) {
      throw new Error(`Trade not found: ${command.tradeId}`);
    }

    const price = await this.queryBus.execute(new GetPriceQuery(trade.symbol)) as Price | null;

    const currentPrice = price?.last || trade.entryExecutedPrice || trade.entry;

    const positionInput = {
      symbol: trade.symbol,
      side: trade.side,
      entry: trade.entryExecutedPrice || trade.entry,
      currentPrice,
      sl: trade.sl,
      tps: trade.tps || [],
      tpsHit: trade.tpsHit || [],
      status: trade.status,
    };

    const positionData = this.positionPnlService.computePositionCardData(positionInput);

    const theme = command.theme === 'light' ? LIGHT_THEME : DARK_THEME;

    const result = await this.canvasAdapter.generateCard(positionData, theme);

    return new GeneratePositionPnlCommandResponse(
      result.buffer,
      result.format,
      result.width,
      result.height,
    );
  }
}