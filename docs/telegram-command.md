# Telegram Command

Responsibility: Handle Telegram commands, user interactions, and trade management operations.

> Uses types from `trade-shared.md`

## Directory Structure

```
src/telegram/command/
├── domain/
│   ├── entities/
│   ├── ports/
│   └── events/
├── application/
│   ├── commands/
│   │   ├── query/
│   │   ├── mutation/
│   │   └── handler/
│   └── queries/
└── infrastructure/
    └── adapters/
```

## Domain

### Entities

**BotCommand**
- `name`: string (e.g., '/start', '/trades')
- `description`: string
- `handler`: CommandHandler
- `validation`: CommandValidation

**CommandValidation**
- `requiresAdmin`: boolean
- `requiresActiveTrade`: boolean
- `validate(params: string[]): ValidationResult`

### Ports

**CommandPort** (inbound)
- `registerCommand(command: BotCommand): void`
- `handleUpdate(update: TelegramUpdate): void`
- `handleCallback(callback: CallbackQuery): void`

**TradePort** (outbound)
- `getTrades(): Promise<Trade[]>`
- `getActiveTrades(): Promise<Trade[]>`
- `getTradeById(id: string): Promise<Trade | null>`
- `cancelTrade(id: string): Promise<void>`
- `deleteTrade(id: string): Promise<void>`
- `modifyEntry(id: string, entry: number): Promise<Trade>`
- `modifySL(id: string, sl: number): Promise<Trade>`
- `modifyTP(id: string, tpIndex: number, tp: number): Promise<Trade>`
- `closeTradeManually(id: string, reason: CloseReason): Promise<Trade>`

**StatePort** (outbound)
- `transitionState(tradeId: string, status: TradeStatus): Promise<Trade>`
- `checkTriggers(tradeId: string, price: number): Promise<TriggerResult>`

**NotificationPort** (outbound)
- `sendMessage(chatId: number, message: string): void`
- `editMessage(chatId: number, messageId: number, message: string): void`

### Events

**CommandExecutedEvent**
- Payload: `command`, `userId`, `params`, `result`

**CommandErrorEvent**
- Payload: `command`, `userId`, `error`

## Application

### Query Commands (Read)

**StartCommand**
- Responds with welcome message and help

**HelpCommand**
- Lists all available commands with descriptions

**TradesCommand**
- Lists all trades (with pagination)
- Options: `--active`, `--history`, `--closed`, `--all`

**ActiveCommand**
- Lists active and pending trades

**HistoryCommand**
- Lists closed/cancelled trades

**StatsCommand**
- Shows trading statistics:
  - Total trades
  - Win rate
  - Average R/R
  - Best/worst trade
  - Trades this week/month

**TradeCommand**
- Input: `/trade <id>`
- Shows detailed trade info

**PriceCommand**
- Input: `/price <symbol>`
- Shows current price from cache

**SettingsCommand**
- Shows current bot settings

### Mutation Commands (Write)

**CancelCommand**
- Input: `/cancel <id>`
- Cancels pending trade
- Validation: only `pending` status

**DeleteCommand**
- Input: `/delete <id>`
- Permanently deletes trade from DB
- Validation: only closed/cancelled trades

**ModifyEntryCommand**
- Input: `/entry <id> <price>`
- Modifies entry price
- Validation: only `pending` status
- Example: `/entry 1 85000`

**ModifySLCommand**
- Input: `/sl <id> <price>`
- Modifies stop loss
- Validation: only before closed
- Example: `/sl 1 78000`

**ModifyTPCommand**
- Input: `/tp <id> <tp_num> <price>`
- Modifies specific TP
- Validation: TP not yet hit
- Example: `/tp 1 2 95000`

**CloseCommand**
- Input: `/close <id> [reason]`
- Manually closes trade
- Reasons: `manual`, `breakeven`
- Validation: only active/partial/breakeven
- Example: `/close 1 manual`

**OpenCommand**
- Input: `/open <id>`
- Forces trade to active (simulates entry hit)
- Useful when entry was missed but user entered manually
- Example: `/open 1`

**BreakevenCommand**
- Input: `/be <id>`
- Moves SL to entry (breakeven)
- Validation: only active/partial_tp status

### Handler Commands (Interactive)

**InlineButtonsHandler**
- Handles callback queries from inline buttons
- Actions: Confirm, Cancel, Edit, Refresh

## Commands List

| Command | Type | Description | Validation |
|---------|------|-------------|-------------|
| `/start` | Query | Welcome message | - |
| `/help` | Query | Show all commands | - |
| `/trades` | Query | List all trades | - |
| `/active` | Query | List active trades | - |
| `/history` | Query | List closed trades | - |
| `/stats` | Query | Show statistics | - |
| `/trade <id>` | Query | Show trade details | - |
| `/price <symbol>` | Query | Show current price | - |
| `/cancel <id>` | Mutation | Cancel pending trade | pending only |
| `/delete <id>` | Mutation | Delete trade | closed only |
| `/entry <id> <price>` | Mutation | Modify entry | pending only |
| `/sl <id> <price>` | Mutation | Modify SL | not closed |
| `/tp <id> <n> <price>` | Mutation | Modify TP | TP not hit |
| `/close <id>` | Mutation | Close manually | active only |
| `/open <id>` | Mutation | Force to active | pending only |
| `/be <id>` | Mutation | Move to breakeven | active only |

## Validation Rules

| Command | Valid Statuses | Invalid Statuses |
|---------|---------------|------------------|
| `/cancel` | pending | active, partial, closed |
| `/delete` | closed_*, cancelled | pending, active |
| `/entry` | pending | active, closed |
| `/sl` | pending, active, partial, breakeven | closed |
| `/tp` | pending, active, partial | closed |
| `/close` | active, partial_tp, breakeven | closed |
| `/open` | pending | active, closed |
| `/be` | active, partial_tp | closed |

## Error Messages

```
❌ Trade not found: #1

❌ Cannot modify entry: trade is already active

❌ Cannot modify TP2: TP already hit

❌ Cannot close: trade is already closed

❌ Cannot cancel: trade already active
```

## Example Responses

### /active
```
📊 Active Trades (3)

1. BTCUSDT LONG
   Entry: 20000 | SL: 18299
   TP1: 25000 ✅ | TP2: 27000
   Status: Partial TP (1/2)

2. ETHUSDT SHORT
   Entry: 3200 | SL: 3350
   TP: 3000
   Status: Pending

3. BNBUSDT SPOT
   Entry: 680
   Status: Pending
```

### /trade 1
```
🔍 Trade #1

BTCUSDT LONG
Entry: 20000 → 20500 (modified)
SL: 18299
TP1: 25000 ✅ | TP2: 27000 | TP3: 28000

Status: Partial TP (1/3)
📈 +2.5R
Created: 2024-01-15 10:30
```

### /stats
```
📈 Statistics (All Time)

Total: 45 trades
Win Rate: 68% (31/45)
Avg R/R: +2.3R

Best: +5.2R (BTC)
Worst: -1.0R (ETH)

This Week: 5 trades (4W/1L)
This Month: 18 trades (12W/6L)
```

### /close 1 manual
```
⏹ CLOSED - MANUAL
BTCUSDT LONG @ 21500
Entry: 20000 | SL: 18299
TP1: 25000 ✅ | TP2: 27000
📈 +0.7R
```

## Inline Keyboard Example

```
📊 Trade #1 - BTCUSDT LONG

Entry: 20000 | SL: 18299
TP1: 25000 | TP2: 27000

[📝 Edit Entry] [✏️ Edit SL] [✏️ Edit TP]
[🔒 Breakeven] [⏹ Close] [🗑️ Delete]
```

## Infrastructure

### Adapters

**TelegramBotAdapter**
- Uses Telegram Bot API
- Webhook or polling mode
- Message formatting
- Inline keyboard support

**TradeFormatterAdapter**
- Formats trade as Telegram message
- Applies markdown/HTML
- Generates inline keyboards