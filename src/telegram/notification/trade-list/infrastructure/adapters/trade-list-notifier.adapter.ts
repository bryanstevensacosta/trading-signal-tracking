import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { SendTradeListCommand } from '../../application/commands/send-trade-list';
import { TradeListNotifierPort, TRADE_LIST_NOTIFIER_PORT } from '../../domain/ports/trade-list-notifier.port';

@Injectable()
export class TradeListNotifierAdapter implements TradeListNotifierPort {
  constructor(private readonly commandBus: CommandBus) {}

  async notify(chatId: number): Promise<void> {
    await this.commandBus.execute(new SendTradeListCommand(chatId));
  }
}

export const TradeListNotifierAdapterProvider = {
  provide: TRADE_LIST_NOTIFIER_PORT,
  useClass: TradeListNotifierAdapter,
};
