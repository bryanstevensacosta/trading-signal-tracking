import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ForceOpenCommand } from '../commands/mutation';
import { TRADE_PORT_TOKEN, TradePort } from '../../domain/ports';
import { CommandResponse } from '../../application/command-response';

@CommandHandler(ForceOpenCommand)
export class ForceOpenHandler implements ICommandHandler<ForceOpenCommand> {
  constructor(@Inject(TRADE_PORT_TOKEN) private readonly repository: TradePort) {}

  async execute(command: ForceOpenCommand): Promise<CommandResponse> {
    const trade = await this.repository.findById(command.tradeId);

    if (!trade) {
      return {
        success: false,
        message: `❌ Trade not found: #${command.tradeId}`,
      };
    }

    if (trade.status !== 'pending') {
      return {
        success: false,
        message: `❌ Can only force open pending trades`,
      };
    }

    await this.repository.update(command.tradeId, { status: 'active' });

    return {
      success: true,
      message: `✅ Trade #${command.tradeId} forced to active`,
    };
  }
}