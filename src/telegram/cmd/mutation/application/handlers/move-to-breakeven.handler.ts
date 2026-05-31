import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { MoveToBreakevenCommand } from '../commands';
import { TRADE_REPOSITORY_PORT, TradeRepositoryPort } from '@trade/repository/domain/ports/trade-repository.port';
import { TradeValidationService } from '@trade/domain';
import { CommandResponse } from '../../../application/command-response';
import { TradeStatus } from '@trade/shared';

@CommandHandler(MoveToBreakevenCommand)
export class MoveToBreakevenHandler implements ICommandHandler<MoveToBreakevenCommand> {
  constructor(
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    private readonly validation: TradeValidationService,
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
      status: TradeStatus.BREAKEVEN,
    });

    return {
      success: true,
      message: `⚖️ Trade #${command.tradeId} moved to breakeven`,
    };
  }
}