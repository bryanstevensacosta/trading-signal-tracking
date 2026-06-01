import { ICommand } from '@nestjs/cqrs';

/**
 * Command to start monitoring a trade.
 */
export class StartMonitoringCommand implements ICommand {
  constructor(public readonly tradeId: string) {}
}