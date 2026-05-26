import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { SendTradeListCommand } from './command';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '@trade/repository/domain/ports/trade-repository.port';
import { TradeDisplayService } from '../../../domain/services/trade-display.service';
import { TradeListCacheService } from '../../../domain/services/trade-list-cache.service';
import { TELEGRAM_PORT, TelegramPort } from '@telegram/notification/single-trade/domain/ports/telegram.port';
import { PRICE_CACHE_PORT, PriceCachePort } from '@price/cache/domain/ports/price-cache.port';
import { Inject, forwardRef } from '@nestjs/common';
import { getTelegramConfig } from '@config/telegram.config';

@CommandHandler(SendTradeListCommand)
export class SendTradeListHandler
  implements ICommandHandler<SendTradeListCommand>
{
  constructor(
    @Inject(forwardRef(() => TRADE_REPOSITORY_PORT))
    private readonly repository: TradeRepositoryPort,
    @Inject(forwardRef(() => PRICE_CACHE_PORT))
    private readonly priceCache: PriceCachePort,
    private readonly displayService: TradeDisplayService,
    private readonly cache: TradeListCacheService,
    @Inject(TELEGRAM_PORT) private readonly telegram: TelegramPort,
  ) {}

  async execute(command: SendTradeListCommand): Promise<void> {
    const telegramConfig = getTelegramConfig();
    const trades = await this.repository.findActive();

    const symbols = [...new Set(trades.map(t => t.symbol))];
    const prices = this.priceCache.getBySymbols(symbols);

    const result = this.displayService.formatTradeList(trades, prices, 1, 100);
    const text = result.trades.join('\n\n');

    const chatId = command.chatId || telegramConfig.groupId;
    const messageId = await this.telegram.sendMessage(
      chatId,
      text,
      { parse_mode: 'HTML' },
      telegramConfig.tradeListThreadId,
    );
    this.cache.set(chatId, messageId, trades);
  }
}