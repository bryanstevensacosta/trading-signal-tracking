import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { GetShareCardPositionPnlCommand } from '../commands';
import { GeneratePositionPnlCommand } from '@trade/share-card/position-pnl/application/commands/generate-position-pnl/command';
import { TRADE_REPOSITORY_PORT, TradeRepositoryPort } from '@trade/repository/domain/ports/trade-repository.port';
import { CommandResponse } from '../../../application/command-response';

@CommandHandler(GetShareCardPositionPnlCommand)
export class GetShareCardPositionPnlHandler implements ICommandHandler<GetShareCardPositionPnlCommand> {
  constructor(
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: GetShareCardPositionPnlCommand): Promise<CommandResponse> {
    const trade = await this.repository.findById(command.tradeId);

    if (!trade) {
      return {
        success: false,
        message: `❌ Trade not found: #${command.tradeId}`,
      };
    }

    try {
      const generateCommand = new GeneratePositionPnlCommand(command.tradeId);
      const result = await this.commandBus.execute(generateCommand);

      return {
        success: true,
        message: `📊 Card for ${trade.symbol}`,
        photo: result.buffer,
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ Error generating card: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}