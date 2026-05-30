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
    // Registrar todos los comandos en el adapter
    this.registerCommands();
  }

  // Registrar handlers de comandos
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
      await this.commandHandler.handleHistory(ctx);
    });

    this.adapter.registerCommandHandler('stats', async (ctx) => {
      await this.commandHandler.handleStats(ctx);
    });

    this.adapter.registerCommandHandler('trade', async (ctx) => {
      const message = ctx.message;
      if (!message) return;
      const text = 'text' in message ? message.text : '';
      const args = text.split(' ');
      const tradeId = args[1];
      await this.commandHandler.handleTrade(ctx, tradeId);
    });

    this.adapter.registerCommandHandler('cancel', async (ctx) => {
      const message = ctx.message;
      if (!message) return;
      const text = 'text' in message ? message.text : '';
      const args = text.split(' ');
      const tradeId = args[1];
      await this.commandHandler.handleCancel(ctx, tradeId, ctx.chat?.id || 0);
    });

    this.adapter.registerCommandHandler('delete', async (ctx) => {
      const message = ctx.message;
      if (!message) return;
      const text = 'text' in message ? message.text : '';
      const args = text.split(' ');
      const tradeId = args[1];
      await this.commandHandler.handleDelete(ctx, tradeId, ctx.chat?.id || 0);
    });

    this.adapter.registerCommandHandler('entry', async (ctx) => {
      const message = ctx.message;
      if (!message) return;
      const text = 'text' in message ? message.text : '';
      const args = text.split(' ');
      const tradeId = args[1];
      const newEntry = parseFloat(args[2]);
      await this.commandHandler.handleEntry(ctx, tradeId, newEntry, ctx.chat?.id || 0);
    });

    this.adapter.registerCommandHandler('sl', async (ctx) => {
      const message = ctx.message;
      if (!message) return;
      const text = 'text' in message ? message.text : '';
      const args = text.split(' ');
      const tradeId = args[1];
      const newSL = parseFloat(args[2]);
      await this.commandHandler.handleSL(ctx, tradeId, newSL, ctx.chat?.id || 0);
    });

    this.adapter.registerCommandHandler('tp', async (ctx) => {
      const message = ctx.message;
      if (!message) return;
      const text = 'text' in message ? message.text : '';
      const args = text.split(' ');
      const tradeId = args[1];
      const tpNum = parseInt(args[2] || '0', 10);
      const newTP = parseFloat(args[3]);
      await this.commandHandler.handleTP(ctx, tradeId, tpNum, newTP, ctx.chat?.id || 0);
    });

    this.adapter.registerCommandHandler('close', async (ctx) => {
      const message = ctx.message;
      if (!message) return;
      const text = 'text' in message ? message.text : '';
      const args = text.split(' ');
      const tradeId = args[1];
      await this.commandHandler.handleClose(ctx, tradeId, ctx.chat?.id || 0);
    });

    this.adapter.registerCommandHandler('be', async (ctx) => {
      const message = ctx.message;
      if (!message) return;
      const text = 'text' in message ? message.text : '';
      const args = text.split(' ');
      const tradeId = args[1];
      await this.commandHandler.handleBE(ctx, tradeId, ctx.chat?.id || 0);
    });

    this.adapter.registerCommandHandler('open', async (ctx) => {
      const message = ctx.message;
      if (!message) return;
      const text = 'text' in message ? message.text : '';
      const args = text.split(' ');
      const tradeId = args[1];
      await this.commandHandler.handleOpen(ctx, tradeId, ctx.chat?.id || 0);
    });

    this.adapter.registerCommandHandler('clean', async (ctx) => {
      await this.commandHandler.handleClean(ctx);
    });

    //3: Registrar handlers de texto y callback
    this.adapter.setTextHandler(async (ctx) => {
      await this.textHandler.handle(ctx);
    });

    this.adapter.setCallbackHandler(async (ctx) => {
      await this.callbackHandler.handle(ctx);
    });

    this.logger.info('All handlers registered in TelegrafCoreAdapter');
  }
}