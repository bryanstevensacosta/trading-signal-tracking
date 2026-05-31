import { ICommand } from '@nestjs/cqrs';

/**
 * Command to generate a position PNL share card image.
 */
export class GeneratePositionPnlCommand implements ICommand {
  constructor(
    public readonly tradeId: string,
    public readonly theme?: 'dark' | 'light',
  ) {}
}