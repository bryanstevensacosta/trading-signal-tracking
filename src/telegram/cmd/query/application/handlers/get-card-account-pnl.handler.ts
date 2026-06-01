import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { CommandBus } from '@nestjs/cqrs';
import { GetShareCardAccountPnlCommand } from '../commands';
import { GenerateAccountPnlCommand } from '@trade/share-card/account-pnl/application/commands/generate-account-pnl/command';
import { CommandResponse } from '../../../application/command-response';

type PeriodType = '24h' | '7d' | '30d' | 'all';

const periodMap: Record<PeriodType, string> = {
  '24h': 'Today',
  '7d': 'Week',
  '30d': 'Month',
  'all': 'All Time',
};

@CommandHandler(GetShareCardAccountPnlCommand)
export class GetShareCardAccountPnlHandler implements ICommandHandler<GetShareCardAccountPnlCommand> {
  constructor(
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: GetShareCardAccountPnlCommand): Promise<CommandResponse> {
    try {
      const periodLabel = periodMap[command.period];
      const generateCommand = new GenerateAccountPnlCommand(periodLabel);
      const result = await this.commandBus.execute(generateCommand);

      return {
        success: true,
        message: `📊 Account PNL - ${periodLabel}`,
        photo: result.buffer,
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ Error generating card: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}