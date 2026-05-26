import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ModifyEntryCommand } from '../commands/mutation';
import { TRADE_PORT_TOKEN, TradePort } from '../../domain/ports';
import { ValidationService } from '../../domain/services';
import { CommandResponse } from '../../application/command-response';

@CommandHandler(ModifyEntryCommand)
export class ModifyEntryHandler implements ICommandHandler<ModifyEntryCommand> {
  constructor(
    @Inject(TRADE_PORT_TOKEN) private readonly repository: TradePort,
    private readonly validation: ValidationService,
  ) {}

  async execute(command: ModifyEntryCommand): Promise<CommandResponse> {
    const trade = await this.repository.findById(command.tradeId);

    if (!trade) {
      return {
        success: false,
        message: `❌ Trade not found: #${command.tradeId}`,
      };
    }

    const validationResult = this.validation.validateModifyEntry(trade, command.newEntry);
    if (!validationResult.valid) {
      return {
        success: false,
        message: `❌ ${validationResult.errors.join(', ')}`,
      };
    }

    await this.repository.update(command.tradeId, { entry: command.newEntry });

    return {
      success: true,
      message: `✏️ Entry updated to ${command.newEntry}`,
    };
  }
}