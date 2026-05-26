import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CloseTradeCommand } from '../commands/mutation';
import { TRADE_PORT_TOKEN, TradePort } from '../../domain/ports';
import { ValidationService } from '../../domain/services';
import { CommandResponse } from '../../application/command-response';

@CommandHandler(CloseTradeCommand)
export class CloseTradeHandler implements ICommandHandler<CloseTradeCommand> {
  constructor(
    @Inject(TRADE_PORT_TOKEN) private readonly repository: TradePort,
    private readonly validation: ValidationService,
  ) {}

  async execute(command: CloseTradeCommand): Promise<CommandResponse> {
    const trade = await this.repository.findById(command.tradeId);

    if (!trade) {
      return {
        success: false,
        message: `❌ Trade not found: #${command.tradeId}`,
      };
    }

    const validationResult = this.validation.validateClose(trade);
    if (!validationResult.valid) {
      return {
        success: false,
        message: `❌ ${validationResult.errors.join(', ')}`,
      };
    }

    await this.repository.update(command.tradeId, {
      status: 'closed_manual',
      closedAt: new Date(),
    });

    return {
      success: true,
      message: `⏹️ Trade #${command.tradeId} closed manually`,
    };
  }
}