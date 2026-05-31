import { ICommand } from '@nestjs/cqrs';

/**
 * Command to check for missed triggers on pending LIMIT orders.
 * Should be run on application startup to recover any triggers that
 * should have fired while the application was down.
 */
export class CheckMissedTriggersCommand implements ICommand {
  constructor(
    public readonly tradeId?: string,
  ) {}
}