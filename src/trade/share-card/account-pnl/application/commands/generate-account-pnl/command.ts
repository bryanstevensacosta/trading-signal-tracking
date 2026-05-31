import { ICommand } from '@nestjs/cqrs';

/**
 * Command to generate an account PNL share card image.
 */
export class GenerateAccountPnlCommand implements ICommand {
  constructor(
    public readonly periodLabel: string = 'Today',
    public readonly theme?: 'dark' | 'light',
  ) {}
}