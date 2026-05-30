import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Context } from 'telegraf';
import { CommandBus } from '@nestjs/cqrs';
import { LOGGER_PORT, LoggerPort } from '@shared/domain/ports/logger.port';
import { CommandResponse } from '../../../command/application/command-response';
import {
  StartCommand,
  HelpCommand,
  GetTradesCommand,
  GetActiveTradesCommand,
  GetTradeByIdCommand,
  GetStatsCommand,
} from '../../../command/query/application/commands';
import {
  CancelTradeCommand,
  DeleteTradeCommand,
  ModifyEntryCommand,
  ModifySLCommand,
  ModifyTPCommand,
  CloseTradeCommand,
  MoveToBreakevenCommand,
  ForceOpenCommand,
} from '../../../command/mutation/application/commands';
import { PendingCleanupService } from '@trade/state/domain/services/pending-cleanup.service';

@Injectable()
export class CommandHandlerService {
  private readonly logger: LoggerPort;

  constructor(
    private readonly commandBus: CommandBus,
    @Inject(forwardRef(() => PendingCleanupService))
    private readonly pendingCleanupService: PendingCleanupService,
    @Inject(LOGGER_PORT) logger: LoggerPort,
  ) {
    this.logger = logger;
  }

  private async cancelPendingBeforeCommand(_ctx: Context): Promise<void> {
    await this.pendingCleanupService.cancelAllPending('New command received - previous pending trade cancelled', 'auto_command');
  }

  // /start - Mensaje de bienvenida
  async handleStart(ctx: Context): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    const result = await this.commandBus.execute(new StartCommand(ctx.chat?.id || 0)) as CommandResponse;
    await this.reply(ctx, result.message);
  }

  // /help - Lista de comandos
  async handleHelp(ctx: Context): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    const result = await this.commandBus.execute(new HelpCommand(ctx.chat?.id || 0)) as CommandResponse;
    await this.reply(ctx, result.message);
  }

  // /trades - Lista todos los trades
  async handleTrades(ctx: Context): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    const result = await this.commandBus.execute(new GetTradesCommand()) as CommandResponse;
    await this.reply(ctx, result.message);
  }

  //4: /active - Lista trades activos
  async handleActive(ctx: Context): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    const result = await this.commandBus.execute(new GetActiveTradesCommand()) as CommandResponse;
    await this.reply(ctx, result.message);
  }

  //5: /history - Historial de trades
  async handleHistory(ctx: Context): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    const result = await this.commandBus.execute(new GetTradesCommand('history')) as CommandResponse;
    await this.reply(ctx, result.message);
  }

  //6: /stats - Estadísticas
  async handleStats(ctx: Context): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    const result = await this.commandBus.execute(new GetStatsCommand()) as CommandResponse;
    await this.reply(ctx, result.message);
  }

  //7: /trade [id] - Ver trade por ID
  async handleTrade(ctx: Context, tradeId: string): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    if (!tradeId) {
      await this.reply(ctx, 'Usage: /trade <trade_id>');
      return;
    }
    const result = await this.commandBus.execute(new GetTradeByIdCommand(tradeId)) as CommandResponse;
    await this.reply(ctx, result.message);
  }

  //8: /cancel [id] - Cancelar trade
  async handleCancel(ctx: Context, tradeId: string, chatId: number): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    if (!tradeId) {
      await this.reply(ctx, 'Usage: /cancel <trade_id>');
      return;
    }
    const result = await this.commandBus.execute(new CancelTradeCommand(tradeId, chatId)) as CommandResponse;
    await this.reply(ctx, result.message);
  }

  //9: /delete [id] - Eliminar trade
  async handleDelete(ctx: Context, tradeId: string, chatId: number): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    if (!tradeId) {
      await this.reply(ctx, 'Usage: /delete <trade_id>');
      return;
    }
    const result = await this.commandBus.execute(new DeleteTradeCommand(tradeId, chatId)) as CommandResponse;
    await this.reply(ctx, result.message);
  }

  //10: /entry [id] [price] - Modificar entry
  async handleEntry(ctx: Context, tradeId: string, newEntry: number, chatId: number): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    if (!tradeId || !newEntry || isNaN(newEntry)) {
      await this.reply(ctx, 'Usage: /entry <trade_id> <price>');
      return;
    }
    const result = await this.commandBus.execute(new ModifyEntryCommand(tradeId, newEntry, chatId)) as CommandResponse;
    await this.reply(ctx, result.message);
  }

  //11: /sl [id] [price] - Modificar SL
  async handleSL(ctx: Context, tradeId: string, newSL: number, chatId: number): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    if (!tradeId || !newSL || isNaN(newSL)) {
      await this.reply(ctx, 'Usage: /sl <trade_id> <price>');
      return;
    }
    const result = await this.commandBus.execute(new ModifySLCommand(tradeId, newSL, chatId)) as CommandResponse;
    await this.reply(ctx, result.message);
  }

  //12: /tp [id] [n] [price] - Modificar TP
  async handleTP(ctx: Context, tradeId: string, tpNum: number, newTP: number, chatId: number): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    if (!tradeId || !tpNum || isNaN(newTP)) {
      await this.reply(ctx, 'Usage: /tp <trade_id> <tp_num> <price>');
      return;
    }
    const result = await this.commandBus.execute(new ModifyTPCommand(tradeId, tpNum, newTP, chatId)) as CommandResponse;
    await this.reply(ctx, result.message);
  }

  //13: /close [id] - Cerrar trade manualmente
  async handleClose(ctx: Context, tradeId: string, chatId: number): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    if (!tradeId) {
      await this.reply(ctx, 'Usage: /close <trade_id>');
      return;
    }
    const result = await this.commandBus.execute(new CloseTradeCommand(tradeId, chatId)) as CommandResponse;
    await this.reply(ctx, result.message);
  }

  //14: /be [id] - Mover a breakeven
  async handleBE(ctx: Context, tradeId: string, chatId: number): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    if (!tradeId) {
      await this.reply(ctx, 'Usage: /be <trade_id>');
      return;
    }
    const result = await this.commandBus.execute(new MoveToBreakevenCommand(tradeId, chatId)) as CommandResponse;
    await this.reply(ctx, result.message);
  }

  //15: /open [id] - Forzar apertura
  async handleOpen(ctx: Context, tradeId: string, chatId: number): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    if (!tradeId) {
      await this.reply(ctx, 'Usage: /open <trade_id>');
      return;
    }
    const result = await this.commandBus.execute(new ForceOpenCommand(tradeId, chatId)) as CommandResponse;
    await this.reply(ctx, result.message);
  }

  //16: /clean - Confirmar limpieza de BD
  async handleClean(ctx: Context): Promise<void> {
    await this.cancelPendingBeforeCommand(ctx);
    await ctx.reply('⚠️ Are you sure you want to delete ALL trades from the database?', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Yes, delete all', callback_data: 'confirm_clean' },
            { text: '❌ No, cancel', callback_data: 'cancel_clean' },
          ],
        ],
      },
    });
  }

  //17: Utility para responder
  private async reply(ctx: Context, text: string): Promise<void> {
    await ctx.reply(text, { parse_mode: 'HTML' });
  }
}