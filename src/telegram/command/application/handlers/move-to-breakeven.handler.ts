import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { MoveToBreakevenCommand } from '../commands/mutation';
import { TRADE_PORT_TOKEN, TradePort } from '../../domain/ports';
import { ValidationService } from '../../domain/services';
import { CommandResponse } from '../../application/command-response';

@CommandHandler(MoveToBreakevenCommand)
export class MoveToBreakevenHandler implements ICommandHandler<MoveToBreakevenCommand> {
  constructor(
    @Inject(TRADE_PORT_TOKEN) private readonly repository: TradePort,
    private readonly validation: ValidationService,
  ) {}

  async execute(command: MoveToBreakevenCommand): Promise<CommandResponse> {
    const trade = await this.repository.findById(command.tradeId);

    if (!trade) {
      return {
        success: false,
        message: `❌ Trade not found: #${command.tradeId}`,
      };
    }

    const validationResult = this.validation.validateBreakeven(trade);
    if (!validationResult.valid) {
      return {
        success: false,
        message: `❌ ${validationResult.errors.join(', ')}`,
      };
    }

    await this.repository.update(command.tradeId, {
      sl: trade.entry,
      status: 'breakeven',
    });

    return {
      success: true,
      message: `⚖️ Trade #${command.tradeId} moved to breakeven`,
    };
  }
}