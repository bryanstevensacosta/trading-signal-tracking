import { ICommand } from '@nestjs/cqrs';

/**
 * Command to check all monitored trades for trigger hits.
 */
export class CheckAllTradesCommand implements ICommand {}