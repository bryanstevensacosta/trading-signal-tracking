import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ModifySLCommand } from '../commands';
import { TRADE_REPOSITORY_PORT, TradeRepositoryPort } from '@trade/repository/domain/ports/trade-repository.port';
import { TradeValidationService } from '@trade/domain';
import { CommandResponse } from '../../../application/command-response';

@CommandHandler(ModifySLCommand)
export class ModifySLHandler implements ICommandHandler<ModifySLCommand> {
  constructor(
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    private readonly validation: TradeValidationService,
  ) {}

  async execute(command: ModifySLCommand): Promise<CommandResponse> {
    const trade = await this.repository.findById(command.tradeId);

    if (!trade) {
      return {
        success: false,
        message: `❌ Trade not found: #${command.tradeId}`,
      };
    }

    const validationResult = this.validation.validateModifySL(trade, command.newSL);
    if (!validationResult.valid) {
      return {
        success: false,
        message: `❌ ${validationResult.errors.join(', ')}`,
      };
    }

    await this.repository.update(command.tradeId, { sl: command.newSL });

    return {
      success: true,
      message: `✏️ SL updated to ${command.newSL}`,
    };
  }
}