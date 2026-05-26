import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetTradeByIdCommand } from '../commands/query';
import { TRADE_PORT_TOKEN, TradePort } from '../../domain/ports';
import { TradeFormatterService } from '../../domain/services';
import { CommandResponse } from '../../application/command-response';

@CommandHandler(GetTradeByIdCommand)
export class GetTradeByIdHandler implements ICommandHandler<GetTradeByIdCommand> {
  constructor(
    @Inject(TRADE_PORT_TOKEN) private readonly repository: TradePort,
    private readonly formatter: TradeFormatterService,
  ) {}

  async execute(command: GetTradeByIdCommand): Promise<CommandResponse> {
    const trade = await this.repository.findById(command.tradeId);

    if (!trade) {
      return {
        success: false,
        message: `❌ Trade not found: #${command.tradeId}`,
      };
    }

    return {
      success: true,
      message: this.formatter.formatForDisplay(trade),
    };
  }
}