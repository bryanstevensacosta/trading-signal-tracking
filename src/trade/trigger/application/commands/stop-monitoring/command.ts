import { ICommand } from '@nestjs/cqrs';

/**
 * Command to stop monitoring a trade.
 */
export class StopMonitoringCommand implements ICommand {
  constructor(
    public readonly tradeId: string,
    public readonly reason?: string,
  ) {}
}