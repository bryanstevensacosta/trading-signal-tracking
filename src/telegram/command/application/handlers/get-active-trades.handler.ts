import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetActiveTradesCommand } from '../commands/query';
import { TRADE_PORT_TOKEN, TradePort } from '../../domain/ports';
import { TradeFormatterService } from '../../domain/services';
import { CommandResponse } from '../../application/command-response';

@CommandHandler(GetActiveTradesCommand)
export class GetActiveTradesHandler implements ICommandHandler<GetActiveTradesCommand> {
  constructor(
    @Inject(TRADE_PORT_TOKEN) private readonly repository: TradePort,
    private readonly formatter: TradeFormatterService,
  ) {}

  async execute(): Promise<CommandResponse> {
    const trades = await this.repository.findActive();

    return {
      success: true,
      message: this.formatter.formatForList(trades),
    };
  }
}