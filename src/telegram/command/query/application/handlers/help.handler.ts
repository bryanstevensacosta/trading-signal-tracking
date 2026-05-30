import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { HelpCommand } from '../commands';
import { TelegramFormatter } from '@telegram/shared/formatters';
import { CommandResponse } from '../../../../command/application/command-response';

@CommandHandler(HelpCommand)
export class HelpHandler implements ICommandHandler<HelpCommand> {
  constructor(private readonly formatter: TelegramFormatter) {}

  async execute(_command: HelpCommand): Promise<CommandResponse> {
    return {
      success: true,
      message: this.formatter.formatHelp(),
    };
  }
}