import { ICommand } from '@nestjs/cqrs';

/**
 * Command to unsubscribe from real-time price updates for multiple symbols.
 */
export class UnsubscribeSymbolsCommand implements ICommand {
  constructor(public readonly symbols: string[]) {}
}