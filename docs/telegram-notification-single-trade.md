# Telegram Notification - Single Trade

Responsibility: Send individual trade alerts to Telegram when events occur.

> Uses types from `trade-shared.md`

## Directory Structure

```
src/telegram/notification/single-trade/
├── domain/
│   ├── services/
│   │   └── NotificationTemplateService
│   ├── ports/
│   └── events/
├── application/
│   └── commands/
└── infrastructure/
    └── adapters/
```

## Domain

### Services

**NotificationTemplateService**
- Generates formatted notification messages
- Maps trade status to emoji and template

### Ports

**NotificationPort** (inbound)
- `sendTradeNotification(trade: Trade, eventType: EventType, price?: number): void`

**TelegramPort** (outbound)
- `sendMessage(chatId: number, text: string, parseMode?: string): void`

### Events

**TradeNotificationEvent**
- Emitted when a trade notification is sent
- Payload: `trade`, `eventType`, `message`

## Application

### Commands

**SendTradeNotificationCommand**
- Input: `trade`, `eventType`, `price`
- Output: `void`
- Generates template, sends to channel

**SendTradeCreatedNotificationCommand**
**SendEntryHitNotificationCommand**
**SendPartialTPNotificationCommand**
**SendBreakevenNotificationCommand**
**SendTradeClosedNotificationCommand**
**SendModificationNotificationCommand**

## Notification Types

### Active States
- ⭐️ New Trade
- ✅ Entry Hit
- 🎯 Partial TP
- 🔒 Breakeven Active

### Closed States
- 🚀 Closed Win (All TP)
- ✅ Closed Partial (TP + SL)
- ❌ Closed Loss (SL only)
- 🔒 Closed Breakeven (No TP)
- 🔒 Closed Breakeven (With TP)
- ⏹ Closed Manual
- ⏹ Closed Manual (With TP)
- 🚫 Cancelled

### Modifications
- 📝 Entry Modified
- ✏️ SL Modified
- ✏️ TP Modified

## Template Format

```
[EMOJI] [TITLE]
[SYMBOL] [SIDE] @ [PRICE]
Entry: [ENTRY] | SL: [SL]
TP1: [TP1] [✅] | TP2: [TP2]
[📈 R/R]
[📊 CHART_URL] | [📝 NOTES]
```

## Configuration

| Option | Type | Description |
|--------|------|-------------|
| `channelId` | number | Target channel/group ID |
| `enabled` | boolean | Enable/disable notifications |
| `notifyNewTrades` | boolean | Notify on new trade |
| `notifyEntryHit` | boolean | Notify on entry |
| `notifyTPHit` | boolean | Notify on TP |
| `notifySLHit` | boolean | Notify on SL |
| `notifyModifications` | boolean | Notify on modifications |
| `includeChartUrl` | boolean | Include chart URL |
| `includeNotes` | boolean | Include notes |
| `includeRR` | boolean | Include R/R |

## Event Flow

```
trade/state: StateChangedEvent
    ↓
Send[EventType]NotificationCommand.execute()
    ↓
NotificationTemplateService.format()
    ↓
TelegramPort.sendMessage()
    ↓
notification sent to channel
```

## Notes

- Each event sends a separate message
- Use Telegram HTML or Markdown parse mode
- Price precision matches asset (BTC: 2 decimals, etc.)
- R/R calculated from entry, SL, TP