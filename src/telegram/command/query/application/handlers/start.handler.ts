import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { StartCommand } from '../commands';
import { TelegramFormatter } from '@telegram/shared/formatters';
import { CommandResponse } from '../../../../command/application/command-response';

@CommandHandler(StartCommand)
export class StartHandler implements ICommandHandler<StartCommand> {
  constructor(private readonly formatter: TelegramFormatter) {}

  async execute(_command: StartCommand): Promise<CommandResponse> {
    return {
      success: true,
      message: this.formatter.formatWelcome(),
    };
  }
}