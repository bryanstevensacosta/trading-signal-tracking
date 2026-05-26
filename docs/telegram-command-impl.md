# telegram/command Implementation Guide

Implementation details for `src/telegram/command/` - handle user commands (modifications, cancellations, etc.).

---

## Directory Structure

```
src/telegram/command/
├── domain/
│   ├── entities/
│   │   └── bot-command.entity.ts
│   ├── ports/
│   │   ├── command.port.ts
│   │   └── trade.port.ts
│   ├── services/
│   │   ├── command-router.service.ts
│   │   ├── validation.service.ts
│   │   └── trade-formatter.service.ts
│   └── events/
│       ├── command-received.event.ts
│       └── index.ts
├── application/
│   ├── commands/
│   │   ├── query/
│   │   │   ├── start.command.ts
│   │   │   ├── help.command.ts
│   │   │   ├── trades.command.ts
│   │   │   └── stats.command.ts
│   │   └── mutation/
│   │   │       ├── cancel.command.ts
│   │   │       ├── modify-entry.command.ts
│   │   │       ├── modify-sl.command.ts
│   │   │       ├── modify-tp.command.ts
│   │   │       ├── close.command.ts
│   │   │       └── index.ts
│   └── handlers/
│       ├── command-handler.ts
│       └── index.ts
├── infrastructure/
│   └── adapters/
│       ├── telegram-bot.adapter.ts
│       └── trade-formatter.adapter.ts
└── index.ts
```

---

## Important Notes

**What telegram/command does:**
- Handle ALL user commands (modifications, cancellations, manual closes)
- Validation of command parameters
- Route commands to appropriate handlers

**What telegram/command does NOT do:**
- State transitions (that goes to trade/state)
- Send notifications (that goes to telegram/notification)
- Parse incoming trade messages (that goes to trade/ingestion)

---

## domain/services/command-router.service.ts

```typescript
import { Injectable } from '@nestjs/common';
import { Message } from 'telegraf/typings/telegram-types';

export interface ParsedCommand {
  name: string;
  args: string[];
}

@Injectable()
export class CommandRouterService {
  parse(text: string): ParsedCommand | null {
    const trimmed = text.trim();
    
    if (!trimmed.startsWith('/')) {
      return null;
    }

    const parts = trimmed.slice(1).split(/\s+/);
    const name = parts[0].toLowerCase();
    const args = parts.slice(1);

    return { name, args };
  }

  route(command: ParsedCommand) {
    const queryCommands = ['start', 'help', 'trades', 'stats'];
    const mutationCommands = ['cancel', 'modify', 'close', 'tp', 'sl', 'entry'];

    if (queryCommands.includes(command.name)) {
      return { type: 'query', command: command.name, args: command.args };
    }

    if (mutationCommands.includes(command.name)) {
      return { type: 'mutation', command: command.name, args: command.args };
    }

    return null;
  }
}
```

---

## domain/services/validation.service.ts

```typescript
import { Injectable } from '@nestjs/common';
import { Trade, isActiveTrade, canCancel, canManualClose } from '../../trade/shared/types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

@Injectable()
export class ValidationService {
  validateModifyEntry(trade: Trade, newEntry: number): ValidationResult {
    const errors: string[] = [];

    if (trade.status !== 'pending') {
      errors.push('Can only modify entry for pending trades');
    }

    if (newEntry <= 0) {
      errors.push('Entry must be positive');
    }

    if (trade.sl && newEntry < trade.sl) {
      errors.push('Entry cannot be below SL');
    }

    return { valid: errors.length === 0, errors };
  }

  validateModifySL(trade: Trade, newSL: number): ValidationResult {
    const errors: string[] = [];

    if (!isActiveTrade(trade.status)) {
      errors.push('Can only modify SL for active trades');
    }

    if (newSL <= 0) {
      errors.push('SL must be positive');
    }

    if (trade.side === 'LONG' && newSL >= trade.entry) {
      errors.push('SL must be below entry for LONG trades');
    }

    if (trade.side === 'SHORT' && newSL <= trade.entry) {
      errors.push('SL must be above entry for SHORT trades');
    }

    return { valid: errors.length === 0, errors };
  }

  validateModifyTP(trade: Trade, newTPs: number[]): ValidationResult {
    const errors: string[] = [];

    if (!isActiveTrade(trade.status)) {
      errors.push('Can only modify TP for active trades');
    }

    newTPs.forEach((tp, index) => {
      if (tp <= 0) {
        errors.push(`TP${index + 1} must be positive`);
      }
    });

    return { valid: errors.length === 0, errors };
  }

  validateCancel(trade: Trade): ValidationResult {
    const errors: string[] = [];

    if (!canCancel(trade.status)) {
      errors.push('Can only cancel pending trades');
    }

    return { valid: errors.length === 0, errors };
  }

  validateClose(trade: Trade): ValidationResult {
    const errors: string[] = [];

    if (!canManualClose(trade.status)) {
      errors.push('Can only close active trades');
    }

    return { valid: errors.length === 0, errors };
  }
}
```

---

## domain/services/trade-formatter.service.ts

```typescript
import { Injectable } from '@nestjs/common';
import { Trade, TradeStatus } from '../../trade/shared/types';
import { formatNumber } from './formatters';

@Injectable()
export class TradeFormatterService {
  formatForDisplay(trade: Trade): string {
    const side = trade.side === 'LONG' ? '🟢 LONG' : trade.side === 'SHORT' ? '🔴 SHORT' : '⚪ SPOT';
    const status = this.formatStatus(trade.status);
    
    let lines = [
      `${side} ${trade.symbol}`,
      `Entry: ${trade.entry}${trade.entryMax ? `-${trade.entryMax}` : ''}`,
    ];

    if (trade.sl) {
      lines.push(`SL: ${trade.sl}`);
    }

    if (trade.tps && trade.tps.length > 0) {
      lines.push(`TP: ${trade.tps.join(' / ')}`);
    }

    lines.push(`Status: ${status}`);

    if (trade.notes) {
      lines.push(`Notes: ${trade.notes}`);
    }

    return lines.join('\n');
  }

  formatForList(trades: Trade[]): string {
    if (trades.length === 0) {
      return 'No trades found';
    }

    const lines = trades.map((trade, index) => {
      const status = this.formatStatus(trade.status);
      return `${index + 1}. ${trade.side} ${trade.symbol} @ ${trade.entry} [${status}]`;
    });

    return lines.join('\n');
  }

  private formatStatus(status: TradeStatus): string {
    const statusMap: Record<TradeStatus, string> = {
      pending: '⏳ Pending',
      active: '✅ Active',
      partial_tp: '🎯 Partial TP',
      breakeven: '⚖️ Breakeven',
      closed_win: '💰 Won',
      closed_partial: '💵 Partial',
      closed_loss: '❌ Lost',
      closed_breakeven: '➖ BE',
      closed_manual: '✋ Closed',
      cancelled: '🚫 Cancelled',
    };

    return statusMap[status] || status;
  }
}
```

---

## domain/ports/command.port.ts

```typescript
export interface CommandPort {
  handleCommand(text: string, chatId: number): Promise<void>;
  handleCallback(callbackData: string, chatId: number): Promise<void>;
}
```

---

## infrastructure/adapters/telegram-bot.adapter.ts

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { CommandBus } from '@nestjs/cqrs';
import { CommandRouterService } from '../../domain/services/command-router.service';
import { TradeFormatterService } from '../../domain/services/trade-formatter.service';
import { TradeRepositoryPort } from '../../trade/repository/domain/ports/trade-repository.port';
import { UpdateTradeCommand } from '../../trade/repository/application/commands/update-trade.command';
import { TransitionStateCommand } from '../../trade/state/application/commands/transition-state.command';
import { TradeStatus, Trade } from '../../trade/shared/types';

@Injectable()
export class TelegramBotAdapter implements OnModuleInit {
  private bot: Telegraf;

  constructor(
    private readonly commandBus: CommandBus,
    private readonly router: CommandRouterService,
    private readonly formatter: TradeFormatterService,
    private readonly repository: TradeRepositoryPort,
  ) {}

  onModuleInit() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.warn('TELEGRAM_BOT_TOKEN not set');
      return;
    }

    this.bot = new Telegraf(token);
    this.setupCommands();
    this.bot.launch();
  }

  private setupCommands() {
    this.bot.command('start', async (ctx) => {
      await ctx.reply('Welcome to Crypto Signals Bot!');
    });

    this.bot.command('help', async (ctx) => {
      await ctx.reply(this.getHelpText());
    });

    this.bot.command('trades', async (ctx) => {
      const trades = await this.repository.findAll();
      const text = this.formatter.formatForList(trades);
      await ctx.reply(text);
    });

    this.bot.command('cancel', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const tradeId = args[1];
      
      if (!tradeId) {
        await ctx.reply('Usage: /cancel <trade_id>');
        return;
      }

      await this.commandBus.execute(
        new TransitionStateCommand(tradeId, TradeStatus.CANCELLED, 'manual_cancel')
      );
      await ctx.reply(`Trade ${tradeId} cancelled`);
    });

    this.bot.command('sl', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const tradeId = args[1];
      const newSL = parseFloat(args[2]);

      if (!tradeId || !newSL) {
        await ctx.reply('Usage: /sl <trade_id> <new_sl>');
        return;
      }

      await this.commandBus.execute(
        new UpdateTradeCommand(tradeId, { sl: newSL })
      );
      await ctx.reply(`SL updated to ${newSL}`);
    });

    this.bot.command('tp', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const tradeId = args[1];
      const newTPs = args.slice(2).map(parseFloat);

      if (!tradeId || newTPs.length === 0) {
        await ctx.reply('Usage: /tp <trade_id> <tp1> <tp2> ...');
        return;
      }

      await this.commandBus.execute(
        new UpdateTradeCommand(tradeId, { tps: newTPs })
      );
      await ctx.reply(`TPs updated to ${newTPs.join(', ')}`);
    });

    this.bot.command('close', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const tradeId = args[1];

      if (!tradeId) {
        await ctx.reply('Usage: /close <trade_id>');
        return;
      }

      await this.commandBus.execute(
        new TransitionStateCommand(tradeId, TradeStatus.CLOSED_MANUAL, 'manual_close')
      );
      await ctx.reply(`Trade ${tradeId} closed`);
    });
  }

  private getHelpText(): string {
    return `
Commands:
/trades - List all trades
/cancel <id> - Cancel pending trade
/sl <id> <price> - Update stop loss
/tp <id> <price1> <price2>... - Update take profits
/close <id> - Manually close trade
/help - Show this help
    `.trim();
  }
}
```

---

## application/commands/mutation/cancel.command.ts

```typescript
import { ICommand } from '@nestjs/cqrs';

export class CancelTradeCommand implements ICommand {
  constructor(
    public readonly tradeId: string,
    public readonly chatId: number,
  ) {}
}
```

---

## application/commands/mutation/modify-sl.command.ts

```typescript
import { ICommand } from '@nestjs/cqrs';

export class ModifySLCommand implements ICommand {
  constructor(
    public readonly tradeId: string,
    public readonly newSL: number,
    public readonly chatId: number,
  ) {}
}
```

---

## application/commands/mutation/modify-tp.command.ts

```typescript
import { ICommand } from '@nestjs/cqrs';

export class ModifyTPCommand implements ICommand {
  constructor(
    public readonly tradeId: string,
    public readonly newTPs: number[],
    public readonly chatId: number,
  ) {}
}
```

---

## application/commands/mutation/close.command.ts

```typescript
import { ICommand } from '@nestjs/cqrs';

export class CloseTradeCommand implements ICommand {
  constructor(
    public readonly tradeId: string,
    public readonly chatId: number,
  ) {}
}
```

---

## Module Configuration

```typescript
// telegram.command.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TelegrafModule } from 'nestjs-telegraf';
import { CommandRouterService } from './domain/services/command-router.service';
import { ValidationService } from './domain/services/validation.service';
import { TradeFormatterService } from './domain/services/trade-formatter.service';
import { TelegramBotAdapter } from './infrastructure/adapters/telegram-bot.adapter';
import { TradeRepositoryModule } from '../../trade/repository/trade.repository.module';
import { TradeStateModule } from '../../trade/state/trade.state.module';

@Module({
  imports: [
    CqrsModule,
    TelegrafModule.register(() => ({ token: process.env.TELEGRAM_BOT_TOKEN! })),
    forwardRef(() => TradeRepositoryModule),
    forwardRef(() => TradeStateModule),
  ],
  providers: [
    CommandRouterService,
    ValidationService,
    TradeFormatterService,
    TelegramBotAdapter,
  ],
  exports: [CommandRouterService, ValidationService, TradeFormatterService],
})
export class TelegramCommandModule {}
```

---

## Command Reference

| Command | Args | Description |
|---------|------|-------------|
| `/start` | - | Start bot |
| `/help` | - | Show help |
| `/trades` | - | List all trades |
| `/stats` | - | Show stats |
| `/cancel` | `<trade_id>` | Cancel pending trade |
| `/sl` | `<trade_id> <price>` | Update SL |
| `/tp` | `<trade_id> <tp1> <tp2>...` | Update TPs |
| `/close` | `<trade_id>` | Manually close trade |
| `/entry` | `<trade_id> <price>` | Update entry (pending only) |

---

## Event Flow

```
User sends command
       │
       ▼
TelegramBotAdapter receives
       │
       ▼
CommandRouterService.parse()
       │
       ▼
Validate command using ValidationService
       │
       ├─► Invalid ──► Reply with error
       │
       └─► Valid ──► Execute command
                     │
                     ├─► Query commands ──► trade/repository
                     │
                     └─► Mutation commands ──► trade/state or trade/repository
```

---

## Dependencies

```json
{
  "@nestjs/common": "^10.0.0",
  "@nestjs/core": "^10.0.0",
  "@nestjs/cqrs": "^10.0.0",
  "telegraf": "^4.15.0",
  "nestjs-telegraf": "^2.2.3"
}
```

Depends on:
- `trade/shared` (types)
- `trade/repository` (queries, updates)
- `trade/state` (state transitions)

---

## Next Context

After completing `telegram/command`, proceed to **telegram/notification/single-trade** for sending individual trade alerts.