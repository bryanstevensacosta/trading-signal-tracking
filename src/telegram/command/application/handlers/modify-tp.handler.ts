import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ModifyTPCommand } from '../commands/mutation';
import { TRADE_PORT_TOKEN, TradePort } from '../../domain/ports';
import { ValidationService } from '../../domain/services';
import { CommandResponse } from '../../application/command-response';

@CommandHandler(ModifyTPCommand)
export class ModifyTPHandler implements ICommandHandler<ModifyTPCommand> {
  constructor(
    @Inject(TRADE_PORT_TOKEN) private readonly repository: TradePort,
    private readonly validation: ValidationService,
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