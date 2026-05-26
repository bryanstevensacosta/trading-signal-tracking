# telegram/notification/trade-list Implementation Guide

Implementation details for `src/telegram/notification/trade-list/` - send and refresh updated trade lists.

---

## Directory Structure

```
src/telegram/notification/trade-list/
├── domain/
│   ├── services/
│   │   ├── trade-list-cache.service.ts   # Cache trade list messages
│   │   ├── trade-list-formatter.service.ts # Format trade list
│   │   └── index.ts
│   ├── ports/
│   │   ├── trade-list-cache.port.ts      # Interface for cache
│   │   ├── telegram.port.ts             # Interface for Telegram
│   │   └── index.ts
│   └── events/
│       ├── trade-list-updated.event.ts
│       └── index.ts
├── application/
│   ├── commands/
│   │   ├── send-trade-list.command.ts
│   │   ├── refresh-trade-list.command.ts
│   │   └── index.ts
│   ├── handlers/
│   │   ├── on-state-changed.handler.ts
│   │   └── index.ts
│   └── index.ts
├── infrastructure/
│   └── adapters/
│       └── index.ts
└── index.ts
```

---

## domain/services/trade-list-formatter.service.ts

```typescript
import { Injectable } from '@nestjs/common';
import { Trade, TradeStatus } from '../../../trade/shared/types';

@Injectable()
export class TradeListFormatterService {
  format(trades: Trade[]): string {
    if (trades.length === 0) {
      return this.formatEmpty();
    }

    const activeTrades = trades.filter(t => this.isActive(t.status));
    const closedTrades = trades.filter(t => this.isClosed(t.status));

    const lines: string[] = ['📊 <b>TRADES</b>\n'];

    if (activeTrades.length > 0) {
      lines.push('<b>Active:</b>');
      activeTrades.forEach((trade, i) => {
        lines.push(this.formatTradeRow(trade, i + 1));
      });
      lines.push('');
    }

    if (closedTrades.length > 0) {
      lines.push('<b>Closed:</b>');
      closedTrades.slice(0, 5).forEach((trade, i) => {
        lines.push(this.formatTradeRow(trade, i + 1, true));
      });
      
      if (closedTrades.length > 5) {
        lines.push(`... and ${closedTrades.length - 5} more`);
      }
    }

    const summary = this.calculateSummary(trades);
    lines.push('');
    lines.push(this.formatSummary(summary));

    return lines.join('\n');
  }

  private formatTradeRow(trade: Trade, index: number, compact = false): string {
    const emoji = this.getStatusEmoji(trade.status);
    const side = trade.side === 'LONG' ? '🟢' : trade.side === 'SHORT' ? '🔴' : '⚪';
    
    if (compact) {
      return `${index}. ${emoji} ${trade.symbol} ${side} @ ${trade.entry}`;
    }

    let row = `${index}. ${side} <b>${trade.symbol}</b> @ ${trade.entry}`;
    
    if (trade.status === 'pending') {
      row += ' ⏳';
    } else if (trade.sl || trade.tps) {
      row += '\n   ';
      if (trade.sl) row += `SL: ${trade.sl} | `;
      if (trade.tps) row += `TP: ${trade.tps[0]}${trade.tps.length > 1 ? ` (+${trade.tps.length - 1})` : ''}`;
    }

    return row;
  }

  private formatEmpty(): string {
    return '📊 <b>TRADES</b>\n\nNo trades yet';
  }

  private formatSummary(summary: { wins: number; losses: number; total: number; winRate: number }): string {
    return `<b>Summary:</b> ${summary.wins}W / ${summary.losses}L | ${summary.winRate}% WR`;
  }

  private calculateSummary(trades: Trade[]): { wins: number; losses: number; total: number; winRate: number } {
    const closed = trades.filter(t => this.isClosed(t.status));
    const wins = closed.filter(t => t.status === 'closed_win').length;
    const losses = closed.filter(t => t.status === 'closed_loss').length;
    const total = closed.length;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    return { wins, losses, total, winRate };
  }

  private isActive(status: TradeStatus): boolean {
    return ['pending', 'active', 'partial_tp', 'breakeven'].includes(status);
  }

  private isClosed(status: TradeStatus): boolean {
    return status.startsWith('closed_') || status === 'cancelled';
  }

  private getStatusEmoji(status: TradeStatus): string {
    const emojiMap: Record<TradeStatus, string> = {
      pending: '⏳',
      active: '✅',
      partial_tp: '🎯',
      breakeven: '⚖️',
      closed_win: '💰',
      closed_partial: '💵',
      closed_loss: '❌',
      closed_breakeven: '➖',
      closed_manual: '✋',
      cancelled: '🚫',
    };
    return emojiMap[status] || '📊';
  }
}
```

---

## domain/services/trade-list-cache.service.ts

```typescript
import { Injectable } from '@nestjs/common';
import { Trade } from '../../../trade/shared/types';

export interface CachedTradeList {
  chatId: number;
  messageId: number;
  trades: Trade[];
  updatedAt: Date;
}

@Injectable()
export class TradeListCacheService {
  private cache: Map<number, CachedTradeList> = new Map();

  set(chatId: number, messageId: number, trades: Trade[]): void {
    this.cache.set(chatId, {
      chatId,
      messageId,
      trades,
      updatedAt: new Date(),
    });
  }

  get(chatId: number): CachedTradeList | null {
    return this.cache.get(chatId) || null;
  }

  update(chatId: number, trades: Trade[]): void {
    const cached = this.cache.get(chatId);
    if (cached) {
      this.cache.set(chatId, {
        ...cached,
        trades,
        updatedAt: new Date(),
      });
    }
  }

  delete(chatId: number): void {
    this.cache.delete(chatId);
  }

  has(chatId: number): boolean {
    return this.cache.has(chatId);
  }

  getAll(): CachedTradeList[] {
    return Array.from(this.cache.values());
  }
}
```

---

## domain/ports/trade-list-cache.port.ts

```typescript
import { Trade } from '../../trade/shared/types';
import { CachedTradeList } from '../services/trade-list-cache.service';

export interface TradeListCachePort {
  set(chatId: number, messageId: number, trades: Trade[]): void;
  get(chatId: number): CachedTradeList | null;
  update(chatId: number, trades: Trade[]): void;
  delete(chatId: number): void;
  has(chatId: number): boolean;
}
```

---

## domain/events/trade-list-updated.event.ts

```typescript
import { Trade } from '../../../trade/shared/types';

export class TradeListUpdatedEvent {
  constructor(
    public readonly trades: Trade[],
    public readonly chatId: number,
  ) {}
}
```

---

## application/commands/send-trade-list.command.ts

```typescript
import { ICommand } from '@nestjs/cqrs';

export class SendTradeListCommand implements ICommand {
  constructor(
    public readonly chatId: number,
  ) {}
}
```

---

## application/commands/refresh-trade-list.command.ts

```typescript
import { ICommand } from '@nestjs/cqrs';

export class RefreshTradeListCommand implements ICommand {
  constructor(
    public readonly chatId: number,
  ) {}
}
```

---

## application/commands/handler/send-trade-list.handler.ts

```typescript
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { SendTradeListCommand } from '../send-trade-list.command';
import { TradeRepositoryPort } from '../../../trade/repository/domain/ports/trade-repository.port';
import { TradeListFormatterService } from '../domain/services/trade-list-formatter.service';
import { TradeListCacheService } from '../domain/services/trade-list-cache.service';
import { TelegramMessageAdapter } from '../../../telegram/notification/single-trade/infrastructure/adapters/telegram-message.adapter';

@CommandHandler(SendTradeListCommand)
export class SendTradeListHandler
  implements ICommandHandler<SendTradeListCommand>
{
  constructor(
    private readonly repository: TradeRepositoryPort,
    private readonly formatter: TradeListFormatterService,
    private readonly cache: TradeListCacheService,
    private readonly telegram: TelegramMessageAdapter,
  ) {}

  async execute(command: SendTradeListCommand) {
    const trades = await this.repository.findAll();
    const text = this.formatter.format(trades);

    const cached = this.cache.get(command.chatId);
    if (cached) {
      await this.telegram.editMessage(
        command.chatId,
        cached.messageId,
        text
      );
      this.cache.update(command.chatId, trades);
    } else {
      const message = await this.telegram.sendMessage(command.chatId, text);
      this.cache.set(command.chatId, message.message_id, trades);
    }

    return trades;
  }
}
```

---

## application/commands/handler/refresh-trade-list.handler.ts

```typescript
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { RefreshTradeListCommand } from '../refresh-trade-list.command';
import { TradeRepositoryPort } from '../../../trade/repository/domain/ports/trade-repository.port';
import { TradeListFormatterService } from '../domain/services/trade-list-formatter.service';
import { TradeListCacheService } from '../domain/services/trade-list-cache.service';
import { TelegramMessageAdapter } from '../../../telegram/notification/single-trade/infrastructure/adapters/telegram-message.adapter';

@CommandHandler(RefreshTradeListCommand)
export class RefreshTradeListHandler
  implements ICommandHandler<RefreshTradeListCommand>
{
  constructor(
    private readonly repository: TradeRepositoryPort,
    private readonly formatter: TradeListFormatterService,
    private readonly cache: TradeListCacheService,
    private readonly telegram: TelegramMessageAdapter,
  ) {}

  async execute(command: RefreshTradeListCommand) {
    const trades = await this.repository.findAll();
    const text = this.formatter.format(trades);

    const cached = this.cache.get(command.chatId);
    if (cached) {
      await this.telegram.editMessage(
        command.chatId,
        cached.messageId,
        text
      );
      this.cache.update(command.chatId, trades);
    }

    return trades;
  }
}
```

---

## application/handlers/on-state-changed.handler.ts

```typescript
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { StateChangedEvent } from '../../../trade/state/domain/events/state-changed.event';
import { RefreshTradeListCommand } from '../commands/refresh-trade-list.command';
import { CommandBus } from '@nestjs/cqrs';

@EventsHandler(StateChangedEvent)
export class OnTradeListRefreshHandler
  implements IEventHandler<StateChangedEvent>
{
  constructor(private readonly commandBus: CommandBus) {}

  async handle(event: StateChangedEvent) {
    const chatId = event.trade.sourceChat || parseInt(process.env.TELEGRAM_CHAT_ID!);
    await this.commandBus.execute(new RefreshTradeListCommand(chatId));
  }
}
```

---

## Module Configuration

```typescript
// telegram.notification.trade-list.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TradeListFormatterService } from './domain/services/trade-list-formatter.service';
import { TradeListCacheService } from './domain/services/trade-list-cache.service';
import { SendTradeListHandler } from './application/commands/handler/send-trade-list.handler';
import { RefreshTradeListHandler } from './application/commands/handler/refresh-trade-list.handler';
import { OnTradeListRefreshHandler } from './application/handlers/on-state-changed.handler';
import { TradeRepositoryModule } from '../../../trade/repository/trade.repository.module';
import { TradeStateModule } from '../../../trade/state/trade.state.module';
import { TelegramNotificationSingleModule } from '../single-trade/telegram.notification.single.module';

const CommandHandlers = [SendTradeListHandler, RefreshTradeListHandler];
const EventHandlers = [OnTradeListRefreshHandler];

@Module({
  imports: [
    CqrsModule,
    forwardRef(() => TradeRepositoryModule),
    forwardRef(() => TradeStateModule),
    forwardRef(() => TelegramNotificationSingleModule),
  ],
  providers: [
    TradeListFormatterService,
    TradeListCacheService,
    ...CommandHandlers,
    ...EventHandlers,
  ],
  exports: [TradeListFormatterService, TradeListCacheService],
})
export class TelegramNotificationTradeListModule {}
```

---

## Usage Example

```typescript
import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { SendTradeListCommand } from './commands/send-trade-list.command';

@Injectable()
export class TradeListService {
  constructor(private readonly commandBus: CommandBus) {}

  async sendList(chatId: number) {
    return this.commandBus.execute(new SendTradeListCommand(chatId));
  }

  async refresh(chatId: number) {
    return this.commandBus.execute(new RefreshTradeListCommand(chatId));
  }
}
```

---

## Event Flow

```
User requests /trades
       │
       ▼
SendTradeListCommand
       │
       ▼
TradeRepository.findAll()
       │
       ▼
TradeListFormatter.format()
       │
       ├─► First time ──► TelegramMessageAdapter.sendMessage()
       │                      │
       │                      ▼
       │                 Cache messageId
       │
       └─► Already cached ──► TelegramMessageAdapter.editMessage()
                                  │
                                  ▼
                           Update cache
```

---

## Dependencies

```json
{
  "@nestjs/common": "^10.0.0",
  "@nestjs/core": "^10.0.0",
  "@nestjs/cqrs": "^10.0.0",
  "telegraf": "^4.15.0"
}
```

Depends on:
- `trade/repository` (to get trades)
- `trade/state` (StateChangedEvent triggers refresh)
- `telegram/notification/single` (TelegramMessageAdapter)

---

## Summary

All bounded contexts have been documented. Here's the complete list:

1. ✅ `trade/shared` - Types, events, constants, helpers
2. ✅ `trade/repository` - SQLite persistence
3. ✅ `trade/parsing` - Message parsing
4. ✅ `trade/ingestion` - Telegram ingestion
5. ✅ `trade/state` - State transitions
6. ✅ `price/exchange` - Exchange adapters (Binance)
7. ✅ `price/stream` - Price streaming
8. ✅ `price/cache` - In-memory price cache
9. ✅ `trade/engine` - Trigger detection
10. ✅ `telegram/command` - User commands
11. ✅ `telegram/notification/single-trade` - Individual alerts
12. ✅ `telegram/notification/trade-list` - Trade list messages

## Next Steps

- Start implementation with Phase 1: trade/shared, trade/repository, trade/parsing
- Or ask for clarification on any specific context