# trade/ingestion Implementation Guide

Implementation details for `src/trade/ingestion/` - receive messages from Telegram, parse, and save trades.

---

## Directory Structure

```
src/trade/ingestion/
├── domain/
│   ├── entities/
│   │   └── incoming-message.entity.ts
│   ├── value-objects/
│   │   └── message-source.vo.ts
│   ├── services/
│   │   ├── message-filter.service.ts
│   │   └── ingestion.service.ts
│   ├── events/
│   │   ├── trade-received.event.ts
│   │   ├── invalid-message.event.ts
│   │   └── index.ts
│   └── errors/
│       └── ingestion-errors.ts
├── application/
│   ├── commands/
│   │   ├── ingest-message.command.ts
│   │   └── index.ts
│   ├── event-handlers/
│   │   ├── on-trade-received.handler.ts
│   │   └── index.ts
│   └── index.ts
├── infrastructure/
│   └── adapters/
│       ├── telegram-ingestion.adapter.ts
│       └── index.ts
└── index.ts
```

---

## domain/value-objects/message-source.vo.ts

```typescript
export interface MessageSource {
  chatId: number;
  messageId: number;
  username?: string;
  firstName?: string;
  timestamp: Date;
}

export class MessageSourceVO implements MessageSource {
  constructor(
    public readonly chatId: number,
    public readonly messageId: number,
    public readonly username?: string,
    public readonly firstName?: string,
    public readonly timestamp: Date = new Date(),
  ) {}

  static fromTelegram(update: any): MessageSourceVO {
    const message = update.message || update.edited_message;
    const chat = message.chat;
    const user = message.from;

    return new MessageSourceVO(
      chat.id,
      message.message_id,
      user?.username,
      user?.first_name,
      new Date(message.date * 1000),
    );
  }
}
```

---

## domain/entities/incoming-message.entity.ts

```typescript
export interface IncomingMessage {
  id: string;
  text: string;
  source: MessageSourceVO;
  raw: any;
  receivedAt: Date;
}
```

---

## domain/services/message-filter.service.ts

```typescript
import { Injectable } from '@nestjs/common';

export interface FilterResult {
  shouldProcess: boolean;
  reason?: string;
}

@Injectable()
export class MessageFilterService {
  private readonly ignoredCommands = [
    '/start',
    '/help',
    '/settings',
    '/stats',
    '/trades',
  ];

  private readonly channelKeywords = [
    'long',
    'short',
    'spot',
    'entry',
    'sl',
    'tp',
    'take profit',
    'stop loss',
  ];

  filter(text: string, chatId: number): FilterResult {
    const lowerText = text.toLowerCase().trim();

    if (!text || text.trim().length === 0) {
      return { shouldProcess: false, reason: 'empty_message' };
    }

    if (this.isCommand(lowerText)) {
      return { shouldProcess: false, reason: 'is_command' };
    }

    if (!this.looksLikeTrade(lowerText)) {
      return { shouldProcess: false, reason: 'not_trade_related' };
    }

    return { shouldProcess: true };
  }

  private isCommand(text: string): boolean {
    return this.ignoredCommands.some(cmd => text.startsWith(cmd));
  }

  private looksLikeTrade(text: string): boolean {
    return this.channelKeywords.some(keyword => text.includes(keyword));
  }
}
```

---

## domain/services/ingestion.service.ts

```typescript
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { MessageFilterService } from './services/message-filter.service';
import { MessageSourceVO } from './value-objects/message-source.vo';
import { TradeReceivedEvent } from './events/trade-received.event';
import { InvalidMessageEvent } from './events/invalid-message.event';

@Injectable()
export class IngestionService {
  constructor(
    private readonly filterService: MessageFilterService,
    @Inject(forwardRef(() => EventBus))
    private readonly eventBus: EventBus,
  ) {}

  async ingest(text: string, source: MessageSourceVO): Promise<void> {
    const filterResult = this.filterService.filter(text, source.chatId);

    if (!filterResult.shouldProcess) {
      await this.eventBus.publish(
        new InvalidMessageEvent(text, source, filterResult.reason!),
      );
      return;
    }

    await this.eventBus.publish(
      new TradeReceivedEvent(text, source),
    );
  }
}
```

---

## domain/events/trade-received.event.ts

```typescript
import { MessageSourceVO } from '../value-objects/message-source.vo';

export class TradeReceivedEvent {
  constructor(
    public readonly text: string,
    public readonly source: MessageSourceVO,
  ) {}
}
```

---

## domain/events/invalid-message.event.ts

```typescript
import { MessageSourceVO } from '../value-objects/message-source.vo';

export class InvalidMessageEvent {
  constructor(
    public readonly text: string,
    public readonly source: MessageSourceVO,
    public readonly reason: string,
  ) {}
}
```

---

## application/commands/ingest-message.command.ts

```typescript
import { ICommand } from '@nestjs/cqrs';
import { MessageSourceVO } from '../../domain/value-objects/message-source.vo';

export class IngestMessageCommand implements ICommand {
  constructor(
    public readonly text: string,
    public readonly source: MessageSourceVO,
  ) {}
}
```

---

## application/commands/handler/ingest-message.handler.ts

```typescript
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { IngestMessageCommand } from '../ingest-message.command';
import { IngestionService } from '../../domain/services/ingestion.service';

@CommandHandler(IngestMessageCommand)
export class IngestMessageHandler
  implements ICommandHandler<IngestMessageCommand>
{
  constructor(private readonly ingestionService: IngestionService) {}

  async execute(command: IngestMessageCommand) {
    await this.ingestionService.ingest(command.text, command.source);
  }
}
```

---

## application/event-handlers/on-trade-received.handler.ts

```typescript
import { EventsHandler, IEventHandler, EventBus } from '@nestjs/cqrs';
import { TradeReceivedEvent } from '../../domain/events/trade-received.event';
import { CommandBus } from '@nestjs/cqrs';
import { ParseTradeCommand } from '../../trade/parsing/commands/parse-trade.command';
import { SaveTradeCommand } from '../../trade/repository/commands/save-trade.command';
import { CreateTradeInput } from '../../shared/types';

@EventsHandler(TradeReceivedEvent)
export class OnTradeReceivedHandler
  implements IEventHandler<TradeReceivedEvent>
{
  constructor(
    private readonly commandBus: CommandBus,
  ) {}

  async handle(event: TradeReceivedEvent) {
    const parseResult = await this.commandBus.execute(
      new ParseTradeCommand(event.text),
    );

    if (parseResult.success) {
      const input: CreateTradeInput = {
        symbol: parseResult.symbol!,
        side: parseResult.side!,
        entry: parseResult.entry!,
        entryMax: parseResult.entryMax || undefined,
        sl: parseResult.sl || undefined,
        tps: parseResult.tps || undefined,
        chartUrl: parseResult.chartUrl || undefined,
        notes: parseResult.notes || undefined,
        sourceMessage: event.text,
        sourceChat: event.source.chatId,
      };

      await this.commandBus.execute(new SaveTradeCommand(input));
    } else {
      // Handle parse failure - could notify user
      console.error('Parse failed:', parseResult.errors);
    }
  }
}
```

---

## infrastructure/adapters/telegram-ingestion.adapter.ts

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { CommandBus } from '@nestjs/cqrs';
import { IngestMessageCommand } from '../../application/commands/ingest-message.command';
import { MessageSourceVO } from '../../domain/value-objects/message-source.vo';

@Injectable()
export class TelegramIngestionAdapter implements OnModuleInit {
  private bot: Telegraf;

  constructor(private readonly commandBus: CommandBus) {}

  onModuleInit() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.warn('TELEGRAM_BOT_TOKEN not set - Telegram ingestion disabled');
      return;
    }

    this.bot = new Telegraf(token);
    this.setupListeners();
  }

  private setupListeners() {
    this.bot.on('message', async (ctx) => {
      const text = ctx.message.text || ctx.message.caption;
      if (!text) return;

      const source = MessageSourceVO.fromTelegram({
        message: {
          chat: ctx.message.chat,
          message_id: ctx.message.message_id,
          from: ctx.message.from,
          date: ctx.message.date,
        },
      });

      await this.commandBus.execute(new IngestMessageCommand(text, source));
    });

    this.bot.launch().catch(err => {
      console.error('Failed to launch Telegram bot:', err);
    });
  }
}
```

---

## domain/errors/ingestion-errors.ts

```typescript
export class IngestionException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IngestionException';
  }
}

export class FilterException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FilterException';
  }
}
```

---

## Module Configuration

```typescript
// trade.ingestion.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TelegrafModule } from 'nestjs-telegraf';
import { IngestionService } from './domain/services/ingestion.service';
import { MessageFilterService } from './domain/services/message-filter.service';
import { IngestMessageHandler } from './application/commands/handler/ingest-message.handler';
import { OnTradeReceivedHandler } from './application/event-handlers/on-trade-received.handler';
import { TelegramIngestionAdapter } from './infrastructure/adapters/telegram-ingestion.adapter';
import { TradeParsingModule } from '../parsing/trade.parsing.module';
import { TradeRepositoryModule } from '../repository/trade.repository.module';

const CommandHandlers = [IngestMessageHandler];
const EventHandlers = [OnTradeReceivedHandler];

@Module({
  imports: [
    CqrsModule,
    TelegrafModule.register(() => ({ token: process.env.TELEGRAM_BOT_TOKEN! })),
    forwardRef(() => TradeParsingModule),
    forwardRef(() => TradeRepositoryModule),
  ],
  providers: [
    IngestionService,
    MessageFilterService,
    TelegramIngestionAdapter,
    ...CommandHandlers,
    ...EventHandlers,
  ],
  exports: [IngestionService, MessageFilterService],
})
export class TradeIngestionModule {}
```

---

## Usage Example

```typescript
import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

@Injectable()
export class TradeBotService {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  async handleIncomingMessage(text: string, chatId: number) {
    // This is handled automatically by TelegramIngestionAdapter
    // but can be called manually if needed
  }
}
```

---

## Event Flow

```
Telegram Message
       │
       ▼
TelegramIngestionAdapter.on('message')
       │
       ▼
IngestMessageCommand
       │
       ▼
IngestionService.ingest()
       │
       ▼
MessageFilterService.filter()
       │
       ├─► InvalidMessageEvent ──► Log/Notify user
       │
       └─► TradeReceivedEvent
                 │
                 ▼
         OnTradeReceivedHandler
                 │
                 ├─► ParseTradeCommand ──► RegexParser
                 │
                 └─► (if success) SaveTradeCommand ──► SQLite
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

---

## Next Context

After completing `trade/ingestion`, proceed to **trade/state** for state transition logic.