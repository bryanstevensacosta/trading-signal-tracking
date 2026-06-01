import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { DeleteTradeCommand } from '../commands';
import { TRADE_REPOSITORY_PORT, TradeRepositoryPort } from '@trade/repository/domain/ports/trade-repository.port';
import { TradeValidationService } from '@trade/domain';
import { CommandResponse } from '../../../application/command-response';

@CommandHandler(DeleteTradeCommand)
export class DeleteTradeHandler implements ICommandHandler<DeleteTradeCommand> {
  constructor(
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    private readonly validation: TradeValidationService,
  ) {}

  async execute(command: DeleteTradeCommand): Promise<CommandResponse> {
    const trade = await this.repository.findById(command.tradeId);

    if (!trade) {
      return {
        success: false,
        message: `❌ Trade not found: #${command.tradeId}`,
      };
    }

    const validationResult = this.validation.validateDelete(trade);
    if (!validationResult.valid) {
      return {
        success: false,
        message: `❌ ${validationResult.errors.join(', ')}`,
      };
    }

    await this.repository.delete(command.tradeId);

    return {
      success: true,
      message: `🗑️ Trade #${command.tradeId} deleted`,
    };
  }
}