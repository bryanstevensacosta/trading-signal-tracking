import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ForceOpenCommand } from '../commands';
import { TRADE_REPOSITORY_PORT, TradeRepositoryPort } from '@trade/repository/domain/ports/trade-repository.port';
import { CommandResponse } from '../../../application/command-response';
import { TradeStatus } from '@trade/shared';

@CommandHandler(ForceOpenCommand)
export class ForceOpenHandler implements ICommandHandler<ForceOpenCommand> {
  constructor(@Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort) {}

  async execute(command: ForceOpenCommand): Promise<CommandResponse> {
    const trade = await this.repository.findById(command.tradeId);

    if (!trade) {
      return {
        success: false,
        message: `❌ Trade not found: #${command.tradeId}`,
      };
    }

    if (trade.status !== TradeStatus.PENDING) {
      return {
        success: false,
        message: `❌ Can only force open pending trades`,
      };
    }

    await this.repository.update(command.tradeId, { status: TradeStatus.ACTIVE });

    return {
      success: true,
      message: `✅ Trade #${command.tradeId} forced to active`,
    };
  }
}