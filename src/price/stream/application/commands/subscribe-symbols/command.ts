import { ICommand } from '@nestjs/cqrs';

/**
 * Command to subscribe to real-time price updates for multiple symbols.
 */
export class SubscribeSymbolsCommand implements ICommand {
  constructor(public readonly symbols: string[]) {}
}