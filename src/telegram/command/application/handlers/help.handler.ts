import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { HelpCommand } from '../commands/query';
import { TradeFormatterService } from '../../domain/services';
import { CommandResponse } from '../../application/command-response';

@CommandHandler(HelpCommand)
export class HelpHandler implements ICommandHandler<HelpCommand> {
  constructor(private readonly formatter: TradeFormatterService) {}

  async execute(_command: HelpCommand): Promise<CommandResponse> {
    return {
      success: true,
      message: this.formatter.formatHelp(),
    };
  }
}