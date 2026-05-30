import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ModifyTPCommand } from '../commands';
import { TRADE_REPOSITORY_PORT, TradeRepositoryPort } from '@trade/repository/domain/ports/trade-repository.port';
import { TradeValidationService } from '@trade/domain';
import { CommandResponse } from '../../../../command/application/command-response';

@CommandHandler(ModifyTPCommand)
export class ModifyTPHandler implements ICommandHandler<ModifyTPCommand> {
  constructor(
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    private readonly validation: TradeValidationService,
  ) {}

  async execute(command: ModifyTPCommand): Promise<CommandResponse> {
    const trade = await this.repository.findById(command.tradeId);

    if (!trade) {
      return {
        success: false,
        message: `❌ Trade not found: #${command.tradeId}`,
      };
    }

    const currentTPs = trade.tps || [];
    const newTPs = [...currentTPs];
    newTPs[command.tpIndex - 1] = command.newTP;

    const validationResult = this.validation.validateModifyTP(trade, newTPs);
    if (!validationResult.valid) {
      return {
        success: false,
        message: `❌ ${validationResult.errors.join(', ')}`,
      };
    }

    await this.repository.update(command.tradeId, { tps: newTPs });

    return {
      success: true,
      message: `✏️ TP${command.tpIndex} updated to ${command.newTP}`,
    };
  }
}