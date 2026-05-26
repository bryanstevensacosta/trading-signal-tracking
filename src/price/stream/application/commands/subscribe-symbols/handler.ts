import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { SubscribeSymbolsCommand } from './command';
import { PriceStreamService } from '../../../domain/services/price-stream.service';
import { Price } from '@trade/shared';

/**
 * Result of SubscribeSymbolsCommand.
 */
export interface SubscribeSymbolsResult {
  symbols: string[];
  subscriptions: Array<{
    symbol: string;
    subscribedAt: Date;
  }>;
}

@CommandHandler(SubscribeSymbolsCommand)
export class SubscribeSymbolsHandler implements ICommandHandler<SubscribeSymbolsCommand> {
  constructor(private readonly priceStream: PriceStreamService) {}

  async execute(command: SubscribeSymbolsCommand): Promise<SubscribeSymbolsResult> {
    const results: SubscribeSymbolsResult = {
      symbols: [],
      subscriptions: [],
    };

    command.symbols.forEach((symbol: string) => {
      const subscription = this.priceStream.subscribe(symbol, (_price: Price) => {
        // Callback is handled by PriceStreamService which publishes events
      });
      results.symbols.push(subscription.symbol);
      results.subscriptions.push({
        symbol: subscription.symbol,
        subscribedAt: subscription.subscribedAt,
      });
    });

    return results;
  }
}