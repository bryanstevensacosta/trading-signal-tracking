import { ICommand } from '@nestjs/cqrs';
import { Trade } from '@trade/shared';

export class SendModificationNotificationCommand implements ICommand {
  constructor(
    public readonly trade: Trade,
    public readonly field: string,
    public readonly oldValue: unknown,
    public readonly newValue: unknown,
    public readonly chatId: number,
  ) {}
}