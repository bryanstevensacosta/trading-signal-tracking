# telegram/notification/single-trade Implementation Guide

Implementation details for `src/telegram/notification/single-trade/` - send individual trade alerts.

---

## Directory Structure

```
src/telegram/notification/single-trade/
├── domain/
│   ├── services/
│   │   ├── notification-template.service.ts  # Format notification messages
│   │   └── index.ts
│   ├── ports/
│   │   ├── notification.port.ts              # Interface for notifications
│   │   ├── telegram.port.ts                  # Interface for Telegram sending
│   │   └── index.ts
│   └── events/
│       ├── trade-notification.event.ts
│       ├── trigger-notification.event.ts
│       └── index.ts
├── application/
│   ├── commands/
│   │   ├── send-trade-notification.command.ts
│   │   ├── send-modification-notification.command.ts
│   │   └── index.ts
│   ├── handlers/
│   │   ├── on-state-changed.handler.ts
│   │   ├── on-trigger-detected.handler.ts
│   │   └── index.ts
│   └── index.ts
├── infrastructure/
│   └── adapters/
│       ├── telegram-message.adapter.ts        # Send via Telegram
│       └── index.ts
└── index.ts
```

---

## domain/services/notification-template.service.ts

```typescript
import { Injectable } from '@nestjs/common';
import { Trade, TradeStatus, TriggerType, TradeSide } from '../../../trade/shared/types';

@Injectable()
export class NotificationTemplateService {
  formatEntryTriggered(trade: Trade): string {
    const emoji = trade.side === 'LONG' ? '🟢' : '🔴';
    return `
${emoji} ENTRY HIT - ${trade.symbol}

Entry: ${trade.entry}
${trade.sl ? `SL: ${trade.sl}` : ''}
${trade.tps ? `TP: ${trade.tps.join(' / ')}` : ''}
    `.trim();
  }

  formatTPHit(trade: Trade, tpIndex: number, rr: number): string {
    const tp = trade.tps?.[tpIndex];
    return `
🎯 TP${tpIndex + 1} HIT - ${trade.symbol}

TP${tpIndex + 1}: ${tp}
RR: ${rr.toFixed(2)}R
    `.trim();
  }

  formatSLHit(trade: Trade, rr: number): string {
    return `
❌ SL HIT - ${trade.symbol}

SL: ${trade.sl}
RR: ${rr.toFixed(2)}R
    `.trim();
  }

  formatTradeClosed(trade: Trade, reason: string): string {
    const statusEmoji = this.getStatusEmoji(trade.status);
    return `
${statusEmoji} TRADE CLOSED - ${trade.symbol}

Reason: ${reason}
Status: ${trade.status}
    `.trim();
  }

  formatTradeCreated(trade: Trade): string {
    const emoji = trade.side === 'LONG' ? '🟢' : trade.side === 'SHORT' ? '🔴' : '⚪';
    return `
${emoji} NEW TRADE - ${trade.symbol}

Side: ${trade.side}
Entry: ${trade.entry}
${trade.entryMax ? `Entry Max: ${trade.entryMax}` : ''}
${trade.sl ? `SL: ${trade.sl}` : ''}
${trade.tps ? `TP: ${trade.tps.join(' / ')}` : ''}
${trade.notes ? `Notes: ${trade.notes}` : ''}
    `.trim();
  }

  formatModification(trade: Trade, field: string, oldValue: any, newValue: any): string {
    return `
✏️ TRADE MODIFIED - ${trade.symbol}

${field}: ${oldValue} → ${newValue}
    `.trim();
  }

  private getStatusEmoji(status: TradeStatus): string {
    const emojiMap: Record<TradeStatus, string> = {
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

## domain/ports/notification.port.ts

```typescript
import { Trade, TradeStatus, TriggerType } from '../../trade/shared/types';

export interface NotificationPort {
  sendEntryTriggered(trade: Trade): Promise<void>;
  sendTPHit(trade: Trade, tpIndex: number, rr: number): Promise<void>;
  sendSLHit(trade: Trade, rr: number): Promise<void>;
  sendTradeClosed(trade: Trade, reason: string): Promise<void>;
  sendTradeCreated(trade: Trade): Promise<void>;
  sendModification(trade: Trade, field: string, oldValue: any, newValue: any): Promise<void>;
}
```

---

## domain/ports/telegram.port.ts

```typescript
export interface TelegramPort {
  sendMessage(chatId: number, text: string, replyMarkup?: any): Promise<void>;
  editMessage(chatId: number, messageId: number, text: string, replyMarkup?: any): Promise<void>;
  deleteMessage(chatId: number, messageId: number): Promise<void>;
}
```

---

## domain/events/trade-notification.event.ts

```typescript
import { Trade, TradeStatus } from '../../../trade/shared/types';

export class TradeNotificationEvent {
  constructor(
    public readonly trade: Trade,
    public readonly type: 'created' | 'closed' | 'modified',
    public readonly metadata?: any,
  ) {}
}
```

---

## domain/events/trigger-notification.event.ts

```typescript
import { Trade, TriggerType } from '../../../trade/shared/types';

export class TriggerNotificationEvent {
  constructor(
    public readonly trade: Trade,
    public readonly trigger: TriggerType,
    public readonly price: number,
    public readonly rr?: number,
  ) {}
}
```

---

## application/commands/send-trade-notification.command.ts

```typescript
import { ICommand } from '@nestjs/cqrs';

export class SendTradeNotificationCommand implements ICommand {
  constructor(
    public readonly tradeId: string,
    public readonly type: 'created' | 'closed' | 'modified',
    public readonly chatId: number,
    public readonly metadata?: any,
  ) {}
}
```

---

## application/handlers/on-state-changed.handler.ts

```typescript
import { EventsHandler, IEventHandler, EventBus } from '@nestjs/cqrs';
import { StateChangedEvent } from '../../../trade/state/domain/events/state-changed.event';
import { NotificationTemplateService } from '../domain/services/notification-template.service';
import { TelegramMessageAdapter } from '../infrastructure/adapters/telegram-message.adapter';

@EventsHandler(StateChangedEvent)
export class OnStateChangedHandler
  implements IEventHandler<StateChangedEvent>
{
  constructor(
    private readonly templates: NotificationTemplateService,
    private readonly telegram: TelegramMessageAdapter,
  ) {}

  async handle(event: StateChangedEvent) {
    const { trade, oldStatus, newStatus, reason } = event;

    let message: string;
    
    switch (newStatus) {
      case 'active':
        message = this.templates.formatEntryTriggered(trade);
        break;
      case 'closed_win':
      case 'closed_loss':
      case 'closed_partial':
      case 'closed_breakeven':
      case 'closed_manual':
        message = this.templates.formatTradeClosed(trade, reason);
        break;
      case 'cancelled':
        message = this.templates.formatTradeClosed(trade, 'cancelled');
        break;
      default:
        return;
    }

    const chatId = trade.sourceChat || parseInt(process.env.TELEGRAM_CHAT_ID!);
    await this.telegram.sendMessage(chatId, message);
  }
}
```

---

## application/handlers/on-trigger-detected.handler.ts

```typescript
import { EventsHandler, IEventHandler, EventBus } from '@nestjs/cqrs';
import { TriggerDetectedEvent } from '../../../trade/engine/domain/events/trigger-detected.event';
import { NotificationTemplateService } from '../domain/services/notification-template.service';
import { TelegramMessageAdapter } from '../infrastructure/adapters/telegram-message.adapter';

@EventsHandler(TriggerDetectedEvent)
export class OnTriggerNotificationHandler
  implements IEventHandler<TriggerDetectedEvent>
{
  constructor(
    private readonly templates: NotificationTemplateService,
    private readonly telegram: TelegramMessageAdapter,
  ) {}

  async handle(event: TriggerDetectedEvent) {
    const { trade, trigger, rr } = event;

    let message: string;

    switch (trigger) {
      case 'entry':
        message = this.templates.formatEntryTriggered(trade);
        break;
      case 'tp':
        message = this.templates.formatTPHit(trade, event.tpIndex!, rr!);
        break;
      case 'sl':
        message = this.templates.formatSLHit(trade, rr!);
        break;
      default:
        return;
    }

    const chatId = trade.sourceChat || parseInt(process.env.TELEGRAM_CHAT_ID!);
    await this.telegram.sendMessage(chatId, message);
  }
}
```

---

## infrastructure/adapters/telegram-message.adapter.ts

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { TelegramPort } from '../domain/ports/telegram.port';

@Injectable()
export class TelegramMessageAdapter implements TelegramPort, OnModuleInit {
  private bot: Telegraf;

  onModuleInit() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.warn('TELEGRAM_BOT_TOKEN not set');
      return;
    }
    this.bot = new Telegraf(token);
  }

  async sendMessage(chatId: number, text: string, replyMarkup?: any): Promise<void> {
    if (!this.bot) return;
    
    await this.bot.telegram.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      ...replyMarkup,
    }).catch(err => {
      console.error('Failed to send message:', err);
    });
  }

  async editMessage(chatId: number, messageId: number, text: string, replyMarkup?: any): Promise<void> {
    if (!this.bot) return;
    
    await this.bot.telegram.editMessageText(chatId, messageId, undefined, text, {
      parse_mode: 'HTML',
      ...replyMarkup,
    }).catch(err => {
      console.error('Failed to edit message:', err);
    });
  }

  async deleteMessage(chatId: number, messageId: number): Promise<void> {
    if (!this.bot) return;
    
    await this.bot.telegram.deleteMessage(chatId, messageId).catch(err => {
      console.error('Failed to delete message:', err);
    });
  }
}
```

---

## Module Configuration

```typescript
// telegram.notification.single.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { NotificationTemplateService } from './domain/services/notification-template.service';
import { TelegramMessageAdapter } from './infrastructure/adapters/telegram-message.adapter';
import { OnStateChangedHandler } from './application/handlers/on-state-changed.handler';
import { OnTriggerNotificationHandler } from './application/handlers/on-trigger-detected.handler';
import { TradeStateModule } from '../../../trade/state/trade.state.module';
import { TradeEngineModule } from '../../../trade/engine/trade.engine.module';

const EventHandlers = [OnStateChangedHandler, OnTriggerNotificationHandler];

@Module({
  imports: [
    CqrsModule,
    forwardRef(() => TradeStateModule),
    forwardRef(() => TradeEngineModule),
  ],
  providers: [
    NotificationTemplateService,
    TelegramMessageAdapter,
    ...EventHandlers,
  ],
  exports: [NotificationTemplateService, TelegramMessageAdapter],
})
export class TelegramNotificationSingleModule {}
```

---

## Usage Example

```typescript
import { Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { StateChangedEvent } from '../../trade/state/domain/events/state-changed.event';

@Injectable()
export class NotificationService {
  constructor(private readonly eventBus: EventBus) {}

  async notifyStateChange(trade: any, oldStatus: string, newStatus: string) {
    await this.eventBus.publish(
      new StateChangedEvent(trade, oldStatus, newStatus, 'trigger')
    );
  }
}
```

---

## Event Flow

```
trade/state: StateChangedEvent
       │
       ▼
OnStateChangedHandler
       │
       ▼
NotificationTemplateService.format*()
       │
       ▼
TelegramMessageAdapter.sendMessage()
       │
       ▼
User receives alert
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
- `trade/state` (StateChangedEvent)
- `trade/engine` (TriggerDetectedEvent)

---

## Next Context

After completing `telegram/notification/single-trade`, proceed to **telegram/notification/trade-list** for sending updated trade lists.