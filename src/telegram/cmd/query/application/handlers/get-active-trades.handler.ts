import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetActiveTradesCommand } from '../commands';
import { TRADE_REPOSITORY_PORT, TradeRepositoryPort } from '@trade/repository/domain/ports/trade-repository.port';
import { TelegramFormatter } from '@telegram/shared/formatters';
import { CommandResponse } from '../../../application/command-response';

@CommandHandler(GetActiveTradesCommand)
export class GetActiveTradesHandler implements ICommandHandler<GetActiveTradesCommand> {
  constructor(
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    private readonly formatter: TelegramFormatter,
  ) {}

  async execute(): Promise<CommandResponse> {
    const trades = await this.repository.findActive();

    return {
      success: true,
      message: this.formatter.formatForList(trades),
    };
  }
}