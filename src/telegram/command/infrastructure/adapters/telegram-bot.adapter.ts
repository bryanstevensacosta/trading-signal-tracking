import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { LOGGER_PORT, LoggerPort } from '../../../../shared/domain/ports/logger.port';
import { CommandBus } from '@nestjs/cqrs';
import { CommandRouterService, TradeFormatterService } from '../../domain/services';
import { TRADE_PORT_TOKEN, TradePort } from '../../domain/ports';
import { CommandResponse } from '../../application/command-response';
import {
  StartCommand,
  HelpCommand,
  GetTradesCommand,
  GetActiveTradesCommand,
  GetTradeByIdCommand,
  GetStatsCommand,
} from '../../application/commands/query';
import {
  CancelTradeCommand,
  DeleteTradeCommand,
  ModifyEntryCommand,
  ModifySLCommand,
  ModifyTPCommand,
  CloseTradeCommand,
  MoveToBreakevenCommand,
  ForceOpenCommand,
  CleanDatabaseCommand,
} from '../../application/commands/mutation';
import { IngestMessageCommand } from '@trade/ingestion/application/commands/ingest-message/command';
import { MessageSourceVO } from '@trade/ingestion/domain/value-objects/message-source.vo';
import { ApproveTradeCommand } from '@telegram/notification/trade-confirmation/application/commands/approve-trade/command';
import { CancelTradeConfirmationCommand } from '@telegram/notification/trade-confirmation/application/commands/cancel-trade/command';
import { EditTradeFieldCommand } from '@telegram/notification/trade-confirmation/application/commands/edit-trade-field/command';
import { EditStateManager } from '@telegram/notification/trade-confirmation/domain/services/edit-state-manager.service';
import { EditTradeTPCommand } from '@telegram/notification/trade-confirmation/application/commands/edit-trade-tp/command';
import { BinanceInfoService } from '@telegram/notification/trade-confirmation/domain/services/binance-info.service';
import { ConfirmationTemplateService } from '@telegram/notification/trade-confirmation/domain/services/confirmation-template.service';

@Injectable()
export class TelegramBotAdapter implements OnModuleInit {
  private bot: Telegraf | null = null;
  private readonly logger: LoggerPort;

  constructor(
    private readonly commandBus: CommandBus,
    private readonly router: CommandRouterService,
    private readonly formatter: TradeFormatterService,
    @Inject(TRADE_PORT_TOKEN) private readonly repository: TradePort,
    private readonly editStateManager: EditStateManager,
    private readonly binanceInfoService: BinanceInfoService,
    private readonly confirmationTemplate: ConfirmationTemplateService,
    @Inject(LOGGER_PORT) logger: LoggerPort,
  ) {
    this.logger = logger;
  }

  async onModuleInit(): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set - Telegram bot disabled');
      return;
    }

    this.bot = new Telegraf(token);
    await this.registerCommands();
    this.setupCommands();
    this.bot.launch();
    this.logger.info('Telegram bot started');
  }

  private async registerCommands(): Promise<void> {
    if (!this.bot) return;

    const commands = [
      { command: 'start', description: 'Start the bot' },
      { command: 'help', description: 'Show all commands' },
      { command: 'trades', description: 'List all trades' },
      { command: 'active', description: 'Show active trades' },
      { command: 'history', description: 'Show trade history' },
      { command: 'stats', description: 'Show trading statistics' },
      { command: 'cancel', description: 'Cancel a trade (Usage: /cancel <trade_id>)' },
      { command: 'delete', description: 'Delete a trade (Usage: /delete <trade_id>)' },
      { command: 'entry', description: 'Modify entry price (Usage: /entry <id> <price>)' },
      { command: 'sl', description: 'Modify stop loss (Usage: /sl <id> <price>)' },
      { command: 'tp', description: 'Modify take profit (Usage: /tp <id> <tp_num> <price>)' },
      { command: 'close', description: 'Close a trade (Usage: /close <trade_id>)' },
      { command: 'be', description: 'Move to breakeven (Usage: /be <trade_id>)' },
      { command: 'open', description: 'Force open a trade (Usage: /open <trade_id>)' },
      { command: 'trade', description: 'Get trade by ID (Usage: /trade <trade_id>)' },
      { command: 'clean', description: 'Delete all trades from database' },
    ];

    try {
      await this.bot.telegram.setMyCommands(commands);
      this.logger.info('Bot commands registered successfully');
    } catch (error) {
      this.logger.error('Failed to register bot commands:', error);
    }
  }

  private setupCommands(): void {
    if (!this.bot) return;

    this.bot.command('start', async (ctx) => {
      const result = await this.commandBus.execute(new StartCommand(ctx.chat.id)) as CommandResponse;
      await this.safeReply(ctx, result.message);
    });

    this.bot.command('help', async (ctx) => {
      const result = await this.commandBus.execute(new HelpCommand(ctx.chat.id)) as CommandResponse;
      await this.safeReply(ctx, result.message);
    });

    this.bot.command('trades', async (ctx) => {
      const result = await this.commandBus.execute(new GetTradesCommand()) as CommandResponse;
      await this.safeReply(ctx, result.message);
    });

    this.bot.command('active', async (ctx) => {
      const result = await this.commandBus.execute(new GetActiveTradesCommand()) as CommandResponse;
      await this.safeReply(ctx, result.message);
    });

    this.bot.command('history', async (ctx) => {
      const result = await this.commandBus.execute(new GetTradesCommand('history')) as CommandResponse;
      await this.safeReply(ctx, result.message);
    });

    this.bot.command('stats', async (ctx) => {
      const result = await this.commandBus.execute(new GetStatsCommand()) as CommandResponse;
      await this.safeReply(ctx, result.message);
    });

    this.bot.command('cancel', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const tradeId = args[1];

      if (!tradeId) {
        await ctx.reply('Usage: /cancel <trade_id>');
        return;
      }

      const result = await this.commandBus.execute(
        new CancelTradeCommand(tradeId, ctx.chat.id),
      ) as CommandResponse;
      await this.safeReply(ctx, result.message);
    });

    this.bot.command('delete', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const tradeId = args[1];

      if (!tradeId) {
        await ctx.reply('Usage: /delete <trade_id>');
        return;
      }

      const result = await this.commandBus.execute(
        new DeleteTradeCommand(tradeId, ctx.chat.id),
      ) as CommandResponse;
      await this.safeReply(ctx, result.message);
    });

    this.bot.command('entry', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const tradeId = args[1];
      const newEntry = parseFloat(args[2]);

      if (!tradeId || !newEntry || isNaN(newEntry)) {
        await ctx.reply('Usage: /entry <trade_id> <price>');
        return;
      }

      const result = await this.commandBus.execute(
        new ModifyEntryCommand(tradeId, newEntry, ctx.chat.id),
      ) as CommandResponse;
      await this.safeReply(ctx, result.message);
    });

    this.bot.command('sl', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const tradeId = args[1];
      const newSL = parseFloat(args[2]);

      if (!tradeId || !newSL || isNaN(newSL)) {
        await ctx.reply('Usage: /sl <trade_id> <price>');
        return;
      }

      const result = await this.commandBus.execute(
        new ModifySLCommand(tradeId, newSL, ctx.chat.id),
      ) as CommandResponse;
      await this.safeReply(ctx, result.message);
    });

    this.bot.command('tp', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const tradeId = args[1];
      const tpNum = parseInt(args[2], 10);
      const newTP = parseFloat(args[3]);

      if (!tradeId || !tpNum || isNaN(newTP)) {
        await ctx.reply('Usage: /tp <trade_id> <tp_num> <price>');
        return;
      }

      const result = await this.commandBus.execute(
        new ModifyTPCommand(tradeId, tpNum, newTP, ctx.chat.id),
      ) as CommandResponse;
      await this.safeReply(ctx, result.message);
    });

    this.bot.command('close', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const tradeId = args[1];

      if (!tradeId) {
        await ctx.reply('Usage: /close <trade_id>');
        return;
      }

      const result = await this.commandBus.execute(
        new CloseTradeCommand(tradeId, ctx.chat.id),
      ) as CommandResponse;
      await this.safeReply(ctx, result.message);
    });

    this.bot.command('be', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const tradeId = args[1];

      if (!tradeId) {
        await ctx.reply('Usage: /be <trade_id>');
        return;
      }

      const result = await this.commandBus.execute(
        new MoveToBreakevenCommand(tradeId, ctx.chat.id),
      ) as CommandResponse;
      await this.safeReply(ctx, result.message);
    });

    this.bot.command('open', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const tradeId = args[1];

      if (!tradeId) {
        await ctx.reply('Usage: /open <trade_id>');
        return;
      }

      const result = await this.commandBus.execute(
        new ForceOpenCommand(tradeId, ctx.chat.id),
      ) as CommandResponse;
      await this.safeReply(ctx, result.message);
    });

    this.bot.command('trade', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const tradeId = args[1];

      if (!tradeId) {
        await ctx.reply('Usage: /trade <trade_id>');
        return;
      }

      const result = await this.commandBus.execute(
        new GetTradeByIdCommand(tradeId),
      ) as CommandResponse;
      await this.safeReply(ctx, result.message);
    });

    this.bot.command('clean', async (ctx) => {
      const result = await this.commandBus.execute(
        new CleanDatabaseCommand(ctx.chat.id),
      ) as CommandResponse;
      await this.safeReply(ctx, result.message);
    });

    this.bot.on('text', async (ctx) => {
      const message = ctx.message;
      if (!message || !('text' in message)) {
        return;
      }

      const text = message.text;

      if (text.startsWith('/')) {
        return;
      }

      const chatId = ctx.chat.id;

      const editingState = this.findEditingState(chatId);
      if (editingState) {
        this.logger.info(`Processing edit input for trade ${editingState.tradeId}, field: ${editingState.field}`);
        await this.commandBus.execute(new EditTradeFieldCommand(
          editingState.tradeId,
          editingState.field,
          text,
          chatId,
        ));
        this.editStateManager.clearEditingState(chatId, editingState.tradeId);
        return;
      }

      try {
        const source = MessageSourceVO.fromTelegram({
          message: {
            chat: message.chat,
            message_id: message.message_id,
            from: 'from' in message ? message.from : undefined,
            date: message.date,
          },
        });

        this.logger.debug(`Ingesting trade message: "${text}" from chat ${source.chatId}`);
        await this.commandBus.execute(new IngestMessageCommand(text, source));
        this.logger.debug(`Trade message ingested: "${text}"`);
      } catch (error) {
        this.logger.error(`Failed to ingest trade message: ${error}`);
        await ctx.reply('Failed to process message. Please try again.');
      }
    });

    this.bot.on('callback_query', async (ctx) => {
      const query = ctx.callbackQuery;
      if (!query || !('data' in query)) {
        return;
      }

      const data = query.data as string;
      const chatId = ctx.chat?.id;
      const messageId = 'message' in query ? query.message?.message_id : undefined;

      if (!chatId) {
        this.logger.warn('Callback query without chatId');
        return;
      }

      const tradeId = this.extractTradeId(data);
      if (!tradeId) {
        await ctx.answerCbQuery('Invalid trade ID');
        return;
      }

      this.logger.debug(`Callback query: ${data} from chat ${chatId}`);

      if (data.startsWith('confirm_approve:')) {
        this.logger.info(`Trade approved: ${tradeId}`);
        await this.commandBus.execute(new ApproveTradeCommand(tradeId, chatId));
        await ctx.answerCbQuery('Trade approved! Monitoring started.');
      } else if (data.startsWith('confirm_cancel:')) {
        this.logger.info(`Trade cancelled: ${tradeId}`);
        await this.commandBus.execute(new CancelTradeConfirmationCommand(tradeId, chatId));
        await ctx.answerCbQuery('Trade cancelled');
      } else if (data.startsWith('confirm_edit:')) {
        this.logger.info(`Edit trade requested: ${tradeId}`);
        const pendingTrade = this.editStateManager.getPendingTrade(chatId, tradeId);
        this.logger.info(`Pending trade: ${JSON.stringify(pendingTrade)}`);
        if (!pendingTrade) {
          this.logger.warn(`No pending trade found for ${tradeId}`);
          await ctx.answerCbQuery('Trade session expired, please send a new trade');
          return;
        }

        try {
          this.logger.info(`Looking up trade ${tradeId} in repository`);
          const trade = await this.repository.findById(tradeId);
          this.logger.info(`Trade found: ${JSON.stringify(trade)}`);
          if (!trade) {
            await ctx.answerCbQuery('Trade not found');
            return;
          }

          const binanceInfo = await this.binanceInfoService.getSymbolInfo(trade.symbol, trade.side);
          const { text, buttons } = this.confirmationTemplate.formatEditMode(
            {
              symbol: trade.symbol,
              side: trade.side as any,
              orderType: trade.orderType as any,
              entry: trade.entry,
              entryMax: trade.entryMax || null,
              sl: trade.sl || null,
              tps: trade.tps || null,
              chartUrl: trade.chartUrl || null,
              notes: trade.notes || null,
            },
            binanceInfo,
            tradeId,
          );

          const inlineButtons = [
            ...buttons.edit,
            ...buttons.approve,
            ...buttons.cancel,
          ];

          await ctx.editMessageText(text, {
            reply_markup: { inline_keyboard: inlineButtons },
          });
        } catch (error) {
          this.logger.error(`Error showing edit mode: ${error}`);
          await ctx.answerCbQuery('Error loading edit mode');
        }
      } else if (data.startsWith('edit_side:')) {
        const field = 'side';
        const pendingTrade = this.editStateManager.getPendingTrade(chatId, tradeId);
        if (messageId) {
          this.editStateManager.startEditing(chatId, tradeId, messageId, field, pendingTrade?.confirmationMessageId);
        }
        await ctx.answerCbQuery('Select new direction');
      } else if (data.startsWith('edit_entry:')) {
        const field = 'entry';
        const pendingTrade = this.editStateManager.getPendingTrade(chatId, tradeId);
        if (messageId) {
          this.editStateManager.startEditing(chatId, tradeId, messageId, field, pendingTrade?.confirmationMessageId);
        }
        await ctx.answerCbQuery('Enter new entry price');
      } else if (data.startsWith('edit_sl:')) {
        const field = 'sl';
        const pendingTrade = this.editStateManager.getPendingTrade(chatId, tradeId);
        if (messageId) {
          this.editStateManager.startEditing(chatId, tradeId, messageId, field, pendingTrade?.confirmationMessageId);
        }
        await ctx.answerCbQuery('Enter new SL price');
      } else if (data.startsWith('edit_tps:')) {
        const field = 'tps';
        const pendingTrade = this.editStateManager.getPendingTrade(chatId, tradeId);
        if (messageId) {
          this.editStateManager.startEditing(chatId, tradeId, messageId, field, pendingTrade?.confirmationMessageId);
        }
        await ctx.answerCbQuery('Enter new TP values (comma separated)');
      } else if (data.startsWith('set_side:')) {
        const parts = data.split(':');
        const side = parts[1];
        const tid = parts[2];
        this.logger.info(`Setting side ${side} for trade ${tid}`);
        await this.commandBus.execute(new EditTradeFieldCommand(tid, 'side', side, chatId));
        await ctx.answerCbQuery(`Side set to ${side}`);
      } else if (data.startsWith('edit_tp_add:')) {
        const tid = data.split(':')[1];
        this.logger.info(`Adding TP to trade ${tid}`);
        if (messageId) {
          const pendingTrade = this.editStateManager.getPendingTrade(chatId, tid);
          this.editStateManager.startEditing(chatId, tid, messageId, 'tps', pendingTrade?.confirmationMessageId);
        }
        await ctx.answerCbQuery('Enter new TP price');
      } else if (data.startsWith('edit_tp_remove:')) {
        const tid = data.split(':')[1];
        this.logger.info(`Removing last TP from trade ${tid}`);
        await this.commandBus.execute(new EditTradeTPCommand(tid, 'remove', chatId));
        await ctx.answerCbQuery('Last TP removed');
      } else {
        await ctx.answerCbQuery('Unknown action');
      }
    });
  }

  private extractTradeId(data: string): string | null {
    const patterns = [
      /^confirm_approve:(.+)$/,
      /^confirm_cancel:(.+)$/,
      /^confirm_edit:(.+)$/,
      /^edit_side:(.+)$/,
      /^edit_entry:(.+)$/,
      /^edit_sl:(.+)$/,
      /^edit_tps:(.+)$/,
      /^set_side:\w+:(.+)$/,
      /^edit_tp_add:(.+)$/,
      /^edit_tp_remove:(.+)$/,
    ];

    for (const pattern of patterns) {
      const match = data.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  private findEditingState(chatId: number): { tradeId: string; field: string } | null {
    const editingStates = this.editStateManager.getAllEditingStates();
    const state = editingStates.find(s => s.chatId === chatId && s.phase === 'waiting_for_value');
    return state ? { tradeId: state.tradeId, field: state.field } : null;
  }

  private async safeReply(ctx: any, text: string): Promise<void> {
    await ctx.reply(text, { parse_mode: 'HTML' });
  }

  private stripHtmlTags(text: string): string {
    return text
      .replace(/<b>(.*?)<\/b>/gi, '*$1*')
      .replace(/<code>(.*?)<\/code>/gi, '`$1`')
      .replace(/<i>(.*?)<\/i>/gi, '_$1_')
      .replace(/<pre>(.*?)<\/pre>/gi, '```$1```')
      .replace(/<[^>]*>/g, '');
  }

  private escapeMarkdownV2(text: string): string {
    const specialChars = /([_*[\]()~`>#+\-=|{}.!\\])/g;
    return text.replace(specialChars, '\\$1');
  }
}