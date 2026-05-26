import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { StartCommand } from '../commands/query';
import { TradeFormatterService } from '../../domain/services';
import { CommandResponse } from '../../application/command-response';

@CommandHandler(StartCommand)
export class StartHandler implements ICommandHandler<StartCommand> {
  constructor(private readonly formatter: TradeFormatterService) {}

  async execute(_command: StartCommand): Promise<CommandResponse> {
    return {
      success: true,
      message: this.formatter.formatWelcome(),
    };
  }
}