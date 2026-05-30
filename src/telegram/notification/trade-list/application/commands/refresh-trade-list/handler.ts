import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { RefreshTradeListCommand } from './command';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '@trade/repository/domain/ports/trade-repository.port';
import { TradeListService } from '../../../domain/services/trade-list.service';
import { TradeListCacheService } from '../../../domain/services/trade-list-cache.service';
import { TELEGRAM_PORT, TelegramPort } from '@telegram/core';
import { PRICE_CACHE_PORT, PriceCachePort } from '@price/cache/domain/ports/price-cache.port';
import { Inject, forwardRef } from '@nestjs/common';
import { getTelegramConfig } from '@config/telegram.config';

@CommandHandler(RefreshTradeListCommand)
export class RefreshTradeListHandler
  implements ICommandHandler<RefreshTradeListCommand>
{
  constructor(
    @Inject(forwardRef(() => TRADE_REPOSITORY_PORT))
    private readonly repository: TradeRepositoryPort,
    @Inject(forwardRef(() => PRICE_CACHE_PORT))
    private readonly priceCache: PriceCachePort,
    private readonly displayService: TradeListService,
    private readonly cache: TradeListCacheService,
    @Inject(TELEGRAM_PORT) private readonly telegram: TelegramPort,
  ) {}

  async execute(command: RefreshTradeListCommand): Promise<void> {
    const telegramConfig = getTelegramConfig();
    const trades = await this.repository.findAll();

    const symbols = [...new Set(trades.map(t => t.symbol))];
    const prices = this.priceCache.getBySymbols(symbols);

    const result = this.displayService.formatTradeList(trades, prices, 1, 100);
    const text = result.trades.join('\n\n');

    const messageId = await this.telegram.sendMessage(
      command.chatId,
      text,
      undefined,
      telegramConfig.tradeListThreadId,
    );
    this.cache.set(command.chatId, messageId, trades);
  }
}