import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetTradeByIdCommand } from '../commands';
import { TRADE_REPOSITORY_PORT, TradeRepositoryPort } from '@trade/repository/domain/ports/trade-repository.port';
import { TelegramFormatter } from '@telegram/shared/formatters';
import { CommandResponse } from '../../../application/command-response';

@CommandHandler(GetTradeByIdCommand)
export class GetTradeByIdHandler implements ICommandHandler<GetTradeByIdCommand> {
  constructor(
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    private readonly formatter: TelegramFormatter,
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