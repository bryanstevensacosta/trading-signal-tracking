import { Injectable, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { TelegrafCoreAdapter } from '../adapters/telegraf-core.adapter';
import { CommandHandlerService } from './command-handler.service';
import { TextHandlerService } from './text-handler.service';
import { CallbackHandlerService } from './callback-handler.service';
import { LOGGER_PORT, LoggerPort } from '@shared/domain/ports/logger.port';

@Injectable()
export class HandlerOrchestratorService implements OnModuleInit {
  private readonly logger: LoggerPort;

  constructor(
    private readonly adapter: TelegrafCoreAdapter,
    @Inject(forwardRef(() => CommandHandlerService))
    private readonly commandHandler: CommandHandlerService,
    @Inject(forwardRef(() => TextHandlerService))
    private readonly textHandler: TextHandlerService,
    @Inject(forwardRef(() => CallbackHandlerService))
    private readonly callbackHandler: CallbackHandlerService,
    @Inject(LOGGER_PORT) logger: LoggerPort,
  ) {
    this.logger = logger;
  }

  async onModuleInit(): Promise<void> {
    this.registerCommands();
  }

  private registerCommands(): void {
    this.adapter.registerCommandHandler('start', async (ctx) => {
      await this.commandHandler.handleStart(ctx);
    });

    this.adapter.registerCommandHandler('help', async (ctx) => {
      await this.commandHandler.handleHelp(ctx);
    });

    this.adapter.registerCommandHandler('trades', async (ctx) => {
      await this.commandHandler.handleTrades(ctx);
    });

    this.adapter.registerCommandHandler('active', async (ctx) => {
      await this.commandHandler.handleActive(ctx);
    });

    this.adapter.registerCommandHandler('history', async (ctx) => {
      const message = ctx.message;
      if (!message) return;
      const text = 'text' in message ? message.text : '';
      const args = text.split(' ').slice(1).join(' ');
      await this.commandHandler.handleHistory(ctx, args);
    });

    this.adapter.registerCommandHandler('stats', async (ctx) => {
      await this.commandHandler.handleStats(ctx);
    });

    this.adapter.registerCommandHandler('trade_edit', async (ctx) => {
      const message = ctx.message;
      if (!message) return;
      const text = 'text' in message ? message.text : '';
      const args = text.split(' ');
      const tradeId = args[1];
      await this.commandHandler.handleTrade(ctx, tradeId);
    });

    this.adapter.registerCommandHandler('clean', async (ctx) => {
      await this.commandHandler.handleClean(ctx);
    });

    this.adapter.registerCommandHandler('share_card_position', async (ctx) => {
      const message = ctx.message;
      if (!message) return;
      const text = 'text' in message ? message.text : '';
      const args = text.split(' ');
      const tradeId = args[1];
      await this.commandHandler.handleShareCardPosition(ctx, tradeId);
    });

    this.adapter.registerCommandHandler('share_card_account', async (ctx) => {
      const message = ctx.message;
      if (!message) return;
      const text = 'text' in message ? message.text : '';
      const args = text.split(' ');
      const period = args[1] || '24h';
      await this.commandHandler.handleShareCardAccount(ctx, period);
    });

    this.adapter.setTextHandler(async (ctx) => {
      await this.textHandler.handle(ctx);
    });

    this.adapter.setCallbackHandler(async (ctx) => {
      await this.callbackHandler.handle(ctx);
    });

    this.logger.info('All handlers registered in TelegrafCoreAdapter');
  }
}