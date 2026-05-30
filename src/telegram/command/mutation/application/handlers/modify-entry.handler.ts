import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ModifyEntryCommand } from '../commands';
import { TRADE_REPOSITORY_PORT, TradeRepositoryPort } from '@trade/repository/domain/ports/trade-repository.port';
import { TradeValidationService } from '@trade/domain';
import { CommandResponse } from '../../../../command/application/command-response';

@CommandHandler(ModifyEntryCommand)
export class ModifyEntryHandler implements ICommandHandler<ModifyEntryCommand> {
  constructor(
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    private readonly validation: TradeValidationService,
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