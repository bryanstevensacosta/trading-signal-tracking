import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { UnsubscribeSymbolsCommand } from './command';
import { PriceStreamService } from '../../../domain/services/price-stream.service';

/**
 * Result of UnsubscribeSymbolsCommand.
 */
export interface UnsubscribeSymbolsResult {
  symbols: string[];
  unsubscribed: string[];
}

@CommandHandler(UnsubscribeSymbolsCommand)
export class UnsubscribeSymbolsHandler implements ICommandHandler<UnsubscribeSymbolsCommand> {
  constructor(private readonly priceStream: PriceStreamService) {}

  async execute(command: UnsubscribeSymbolsCommand): Promise<UnsubscribeSymbolsResult> {
    const symbols = command.symbols.map((s: string) => s.toUpperCase());
    const results: UnsubscribeSymbolsResult = {
      symbols,
      unsubscribed: [],
    };

    symbols.forEach((symbol: string) => {
      if (this.priceStream.isSubscribed(symbol)) {
        this.priceStream.unsubscribe(symbol);
        results.unsubscribed.push(symbol);
      }
    });

    return results;
  }
}