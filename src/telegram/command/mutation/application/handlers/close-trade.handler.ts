import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CloseTradeCommand } from '../commands';
import { TRADE_REPOSITORY_PORT, TradeRepositoryPort } from '@trade/repository/domain/ports/trade-repository.port';
import { TradeValidationService } from '@trade/domain';
import { CommandResponse } from '../../../../command/application/command-response';
import { TradeStatus } from '@trade/shared';

@CommandHandler(CloseTradeCommand)
export class CloseTradeHandler implements ICommandHandler<CloseTradeCommand> {
  constructor(
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    private readonly validation: TradeValidationService,
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
      status: TradeStatus.CLOSED_MANUAL,
      closedAt: new Date(),
    });

    return {
      success: true,
      message: `⏹️ Trade #${command.tradeId} closed manually`,
    };
  }
}