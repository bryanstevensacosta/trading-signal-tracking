# Análisis de Sub-Bounded Contexts para Telegram

## Visión General

Propuesta de segregación del BC `telegram/` en 4 sub-bounded contexts + 1 módulo compartido:

```
telegram/
├── bot/              # Infraestructura pura del bot
├── command/          # Manejo de comandos entrantes
├── confirmation/    # Workflow interactivo de confirmación
├── notification/    # Notificaciones automatizadas
└── shared/
    └── formatters/  # Formatters centralizados
```

---

## 1. BOT (Infraestructura del Bot)

### Propósito
Inicialización y configuración del bot Telegram. Es la capa de adaptación más externa. Punto de entrada único para Telegraf.

### Responsabilidades
- Inicializar Telegraf con el token del bot
- Registrar comandos del menú (/start, /help, /trades, etc.)
- Configurar handlers para texto y callback queries
- Manejar lifecycle del bot (launch/shutdown)
- Middlewares de logging

### Servicios
- `TelegramBotAdapter` (actualmente en `command/infrastructure/adapters/telegram-bot.adapter.ts`)

### Puertos
- `TelegramPort` - interfaz para enviar/editar/borrar mensajes

### Adapters
- `TelegrafAdapter` - implementación usando librería telegraf

### Archivo Principal Actual
```
src/telegram/command/infrastructure/adapters/telegram-bot.adapter.ts (523 líneas)
```

### Dependencias
- Librería: `telegraf`
- Env vars: `TELEGRAM_BOT_TOKEN`

### Comandos Registrados
| Comando | Descripción | Handler |
|---------|--------------|---------|
| `/start` | Iniciar el bot | StartCommand |
| `/help` | Mostrar ayuda | HelpCommand |
| `/trades` | Lista todos los trades | GetTradesCommand |
| `/active` | Mostrar trades activos | GetActiveTradesCommand |
| `/history` | Historial de trades cerrados | GetTradesCommand |
| `/stats` | Estadísticas | GetStatsCommand |
| `/cancel [id]` | Cancelar trade pending | CancelTradeCommand |
| `/delete [id]` | Eliminar trade cerrado | DeleteTradeCommand |
| `/entry [id] [price]` | Modificar entry | ModifyEntryCommand |
| `/sl [id] [price]` | Modificar stop loss | ModifySLCommand |
| `/tp [id] [n] [price]` | Modificar take profit | ModifyTPCommand |
| `/close [id]` | Cerrar trade manualmente | CloseTradeCommand |
| `/be [id]` | Mover a breakeven | MoveToBreakevenCommand |
| `/open [id]` | Forzar abrir trade | ForceOpenCommand |
| `/trade [id]` | Ver trade por ID | GetTradeByIdCommand |
| `/clean` | Borrar todos los trades | CleanDatabaseCommand |

### Eventos Telegraf Manejados
- `bot.command()` - 15 comandos slash
- `bot.on('text')` - Mensajes no-comando para ingestion
- `bot.on('callback_query')` - Botones inline (approve, cancel, edit)

---

## 2. COMMAND (Manejo de Comandos)

### Propósito
Procesar todos los comandos que el usuario envía al bot. Maneja tanto queries (solo lectura) como mutations (operaciones que modifican estado).

### Responsabilidades
- Parsear y rutear comandos entrantes
- Validar operaciones usando reglas de negocio
- Consultar trades (queries)
- Ejecutar mutaciones (cancel, delete, modify, close, force-open, clean)
- Formatear respuestas para el usuario
- Integración con IngestMessageCommand (trade parsing)

### Command Handlers

#### Query Commands (solo lectura)
| Handler | Función | Lógica |
|---------|---------|--------|
| `StartHandler` | Responde a /start | Solo formatea mensaje welcome |
| `HelpHandler` | Responde a /help | Solo formatea ayuda |
| `GetTradesHandler` | Lista trades | Busca trades, formatea lista paginada |
| `GetActiveTradesHandler` | Lista activos | Query simple, formatea lista |
| `GetTradeByIdHandler` | Ver trade por ID | Busca trade, formatea display |
| `GetStatsHandler` | Estadísticas | Calcula stats, formatea |

#### Mutation Commands (modifican estado)
| Handler | Función | Validación |
|---------|---------|------------|
| `CancelTradeHandler` | Cancela trade pending | Solo pending |
| `DeleteTradeHandler` | Elimina trade | Solo closed/cancelled |
| `ModifyEntryHandler` | Modifica entry | Entry > 0, entry > SL |
| `ModifySLHandler` | Modifica stop loss | SL > 0, dirección según side |
| `ModifyTPHandler` | Modifica take profit | TP > 0 |
| `CloseTradeHandler` | Cierra trade manualmente | Solo active |
| `MoveToBreakevenHandler` | Mueve SL a entry | Solo active/partial_tp |
| `ForceOpenHandler` | Cambia pending → active | Solo pending |
| `CleanDatabaseHandler` | Borra todos los trades | Requiere confirmación |

### Servicios

#### ValidationService
**Propósito:** Validar operaciones según el estado actual del trade

**Métodos:**
```typescript
validateTradeId(tradeId: string): ValidationResult
validateEntryPrice(price: number): ValidationResult
validateModifyEntry(trade: Trade, newEntry: number): ValidationResult
validateModifySL(trade: Trade, newSL: number): ValidationResult
validateModifyTP(trade: Trade, newTPs: number[]): ValidationResult
validateCancel(trade: Trade): ValidationResult
validateClose(trade: Trade): ValidationResult
validateBreakeven(trade: Trade): ValidationResult
validateDelete(trade: Trade): ValidationResult
```

**Reglas de negocio:**
- `canCancel()` - solo trades pending
- `canModifyEntry()` - solo pending
- `canModifySL()` - solo active
- `canManualClose()` - solo active
- `canMoveToBreakeven()` - solo active o partial_tp
- Solo delete trades closed/cancelled

#### CommandRouterService
**Propósito:** Parsear y rutear comandos a query/mutation

**Métodos:**
```typescript
parse(text: string): ParsedCommand | null
route(command: ParsedCommand): {type, name, args} | null
```

**Comandos query:** start, help, trades, active, history, stats, trade, price
**Comandos mutation:** cancel, delete, entry, sl, tp, close, open, be

### Puertos

#### TradePort
```typescript
interface TradePort {
  findById(id: string): Promise<Trade | null>
  findAll(): Promise<Trade[]>
  findActive(): Promise<Trade[]>
  findPending(): Promise<Trade[]>
  update(id: string, input: unknown): Promise<Trade | null>
  delete(id: string): Promise<boolean>
  deleteAll(): Promise<number>
}
```

**Consumido por:** 13 handlers

### Archivos Actuales
```
src/telegram/command/
├── domain/
│   ├── services/
│   │   ├── validation.service.ts       # Lógica de validación
│   │   ├── command-router.service.ts   # Parse y route
│   │   └── trade-formatter.service.ts  # Formateo (MOVER A shared/)
│   └── ports/
│       └── trade.port.ts               # CRUD trades
├── application/
│   ├── handlers/                        # 12 handlers
│   └── commands/
│       ├── query/                       # 6 queries
│       └── mutation/                    # 9 mutations
└── infrastructure/
    └── adapters/
        └── telegram-bot.adapter.ts     # Mover a bot/
```

---

## 3. CONFIRMATION (Workflow Interactivo)

### Propósito
Manejar el flujo interactivo de confirmación de trades cuando el usuario envía un mensaje de trade (no usa comandos). Includes edición con botones inline y consulta a Binance.

### Flujo Actual
1. Usuario envía mensaje de trade (ej: "LONG BTCUSDT Entry: 50000 SL: 49000 TP: 51000")
2. TelegramBotAdapter recibe el mensaje y ejecuta `IngestMessageCommand`
3. El mensaje se parsea y guarda el trade como PENDING
4. **SendConfirmationHandler** envía mensaje de confirmación con botones inline
5. Usuario puede:
   - **Aprobar** → ApproveTradeHandler → Inicia monitoreo → Trade pasa a ACTIVE
   - **Cancelar** → CancelTradeConfirmationHandler → Trade pasa a CANCELLED
   - **Editar** → Edit mode con botones inline para modificar campos

### Command Handlers

| Handler | Función |
|---------|---------|
| `SendConfirmationHandler` | Crea trade PENDING, obtiene info Binance, envía confirmación |
| `ApproveTradeHandler` | Cambia a ACTIVE, inicia monitoreo, actualiza tradeAlertsMessageId |
| `CancelTradeConfirmationHandler` | Cancela trade pending |
| `EditTradeFieldHandler` | Actualiza campo (side/entry/sl/tps), re-renderiza mensaje |
| `EditTradeTPHandler` | Agrega/remove TP |

### Servicios

#### EditStateManager
**Propósito:** Máquina de estados para el flujo de edición interactiva

**Estados:**
```typescript
interface EditState {
  tradeId: string
  chatId: number
  messageId: number
  field: string
  phase: 'waiting_for_value' | 'confirming'
  confirmationMessageId?: number
}
```

**Métodos:**
```typescript
startEditing(chatId, tradeId, messageId, field, confirmationMessageId?): void
getEditingState(chatId, tradeId): EditState | undefined
isWaitingForValue(chatId, tradeId): boolean
clearEditingState(chatId, tradeId): void
addPendingTrade(chatId, tradeId, messageId, confirmationMessageId, editButtons): void
getPendingTrade(chatId, tradeId): PendingTrade | undefined
removePendingTrade(chatId, tradeId): void
```

**Características:**
- Timeout de 120 segundos para cleanup automático
- Mantiene Map en memoria de estados de edición
- Fase 1: `waiting_for_value` - espera input del usuario
- Fase 2: `confirming` - confirmación del valor

#### BinanceInfoService
**Propósito:** Obtener información de símbolos de Binance

**Métodos:**
```typescript
async getSymbolInfo(symbol: string, side: TradeSide): Promise<BinanceInfoData>
```

**BinanceInfoData:**
```typescript
{
  price: string      // precio actual
  change24h: string  // cambio 24h %
  volume: string     // volumen formateado
  high: string       // high 24h
  low: string        // low 24h
}
```

**Lógica:**
- Determina si es futures basado en side (LONG/SHORT = futures, SPOT = spot)
- Formatea volumen (K/M suffix)

#### ConfirmationTemplateService
**Propósito:** Formatear mensajes de confirmación y edit mode (MOVER A shared/)

### Puertos

#### BinanceInfoPort
```typescript
interface BinanceInfoPort {
  getTickerInfo(symbol: string, isFutures: boolean): Promise<BinanceInfo>
}
```

### Adapters

#### BinanceInfoAdapter
- Implementa `BinanceInfoPort`
- Llama a REST API de Binance
- Endpoints: `api.binance.com` (spot) o `fapi.binance.com` (futures)

### Archivos Actuales
```
src/telegram/notification/trade-confirmation/
├── domain/
│   ├── services/
│   │   ├── edit-state-manager.service.ts      # Máquina de estados
│   │   ├── binance-info.service.ts            # Info Binance
│   │   └── confirmation-template.service.ts  # Formateo (MOVER A shared/)
│   └── ports/
│       └── binance-info.port.ts
├── application/
│   └── commands/
│       ├── send-confirmation/
│       ├── approve-trade/
│       ├── cancel-trade/
│       ├── edit-trade-field/
│       └── edit-trade-tp/
└── infrastructure/
    └── adapters/
        └── binance-info.adapter.ts            # API Binance
```

---

## 4. NOTIFICATION (Notificaciones Automatizadas)

### Propósito
Enviar notificaciones automáticas cuando ocurren eventos en trades (TP hit, SL hit, entry triggered, estado cambiado). Escucha eventos de otros bounded contexts.

### Responsabilidades
- Escuchar eventos de otros BCs (StateChangedEvent, TriggerDetectedEvent, TradeUpdatedEvent)
- Formatear y enviar notificaciones individuales
- Mantener lista de trades con paginación
- Batching de notificaciones (ventana de 60s)
- Cache de mensajes para edición in-place

### Event Handlers

#### OnStateChangedHandler (single-trade)
**Evento:** `StateChangedEvent` (desde `@trade/state`)

**Estados que maneja:**
- `active` - no envía notificación
- `breakeven` - envía notificación
- `closed_win`, `closed_partial`, `closed_loss`, `closed_breakeven`, `closed_manual` - envía notificación
- `cancelled` - envía notificación

**Acciones:**
1. Formatea mensaje según nuevo estado
2. Envía a chat privado del usuario
3. Envía al grupo de Telegram
4. Si está cerrado → ejecuta `RefreshTradeListCommand`

#### OnTriggerNotificationHandler (single-trade)
**Evento:** `TriggerDetectedEvent` (desde `@trade/engine`)

**Triggers:**
- `entry` - Entry alcanzado
- `tp` - Take profit alcanzado
- `sl` - Stop loss alcanzado
- `breakeven` - Breakeven alcanzado

**Acciones:**
1. Formatea mensaje según trigger
2. Envía notificación
3. Actualiza `tradeAlertsMessageId` en el trade

#### OnTradeModifiedHandler (single-trade)
**Evento:** `TradeUpdatedEvent` (desde `@trade/shared`)

**Acciones:**
1. Formatea mensaje de modificación
2. Envía a privado y grupo

#### OnTradeListRefreshHandler (trade-list)
**Evento:** `StateChangedEvent` (desde `@trade/state`)

**Acciones:**
1. Encola notificación en el batcher
2. NO envía inmediatamente (batching)

### Servicios

#### NotificationBatcherService
**Propósito:** Agrupar notificaciones para enviar una sola cada 60 segundos

**Características:**
- Ventana de batching: 60,000ms (60 segundos)
- Una notificación por chatId aunque ocurran múltiples eventos
- Flush automático cuando expira el timer

**Métodos:**
```typescript
enqueueNotification(chatId: number): void
hasPendingBatch(chatId: number): boolean
getPendingCount(): number
```

#### TradeListCacheService
**Propósito:** Cache en memoria de la lista de trades por chatId

**Permite:**
- Editar mensaje existente en lugar de crear nuevo
- Actualización in-place de la lista

**Métodos:**
```typescript
set(chatId, messageId, trades): void
get(chatId): CachedTradeList | null
update(chatId, trades): void
delete(chatId): void
has(chatId): boolean
getAll(): CachedTradeList[]
```

#### TradeDisplayService
**Propósito:** Formatear lista completa de trades con PnL y paginación (MOVER A shared/)

**Características:**
- Cálculo de PnL (risk-reward ratio)
- Paginación
- Filtrado active/closed

#### TradeListFormatterService
**Propósito:** Formatear lista simple de trades (MOVER A shared/)

### Puertos

#### TelegramPort
```typescript
interface TelegramPort {
  sendMessage(chatId, text, replyMarkup?, messageThreadId?, replyToMessageId?): Promise<number>
  editMessage(chatId, messageId, text, replyMarkup?, messageThreadId?): Promise<void>
  deleteMessage(chatId, messageId, messageThreadId?): Promise<void>
}
```

**NOTA:** Actualmente duplicado en single-trade y re-exportado en trade-list. Debe existir UNO solo en `bot/`.

#### TradeListCachePort
```typescript
interface TradeListCachePort {
  set(chatId, messageId, trades): void
  get(chatId): CachedTradeList | null
  update(chatId, trades): void
  delete(chatId): void
  has(chatId): boolean
}
```

### Adapters

#### TelegramMessageAdapter
- Implementa `TelegramPort`
- **PROBLEMA:** Existe duplicado en single-trade y trade-list

### Archivos Actuales
```
src/telegram/notification/single-trade/
├── domain/
│   ├── services/
│   │   └── notification-template.service.ts  # Formateo (MOVER A shared/)
│   └── ports/
│       └── telegram.port.ts                  # DUPLICADO - mover a bot/
├── application/
│   └── event-handlers/
│       ├── on-state-changed.handler.ts
│       ├── on-trigger-detected.handler.ts
│       └── on-trade-modified.handler.ts
└── infrastructure/
    └── adapters/
        └── telegram-message.adapter.ts      # DUPLICADO

src/telegram/notification/trade-list/
├── domain/
│   ├── services/
│   │   ├── trade-display.service.ts           # Formateo (MOVER A shared/)
│   │   ├── trade-list-formatter.service.ts  # Formateo (MOVER A shared/)
│   │   ├── trade-list-cache.service.ts       # Cache
│   │   └── notification-batcher.service.ts  # Batching
│   └── ports/
│       ├── telegram.port.ts                  # RE-EXPORT - eliminar
│       ├── trade-list-cache.port.ts
│       └── trade-list-notifier.port.ts
├── application/
│   ├── commands/
│   │   ├── send-trade-list/
│   │   └── refresh-trade-list/
│   └── event-handlers/
│       └── on-state-changed.handler.ts
└── infrastructure/
    └── adapters/
        ├── telegram-message.adapter.ts      # DUPLICADO
        └── trade-list-notifier.adapter.ts
```

---

## 5. SHARED/FORMATTERS (Formatters Centralizados)

### Propósito
Centralizar TODO el formateo de mensajes para display. Eliminar duplicación de lógica.

### Servicios Propuestos

#### emoji.formatter.ts
**Propósito:** Centralizar todos los mappings de emoji

**DUPLICACIÓN ENCONTRADA:**

| Servicio | Método | Líneas |
|----------|--------|--------|
| TradeDisplayService | getStatusEmoji() | 153-166 |
| TradeListFormatterService | getStatusEmoji() | 92-105 |
| NotificationTemplateService | getStatusEmoji() | 82-95 |
| TradeFormatterService | formatStatus() | 109-124 |

**Mappings a centralizar:**
```typescript
statusEmoji: {
  pending: '⏳',
  active: '✅',
  partial_tp: '🎯',
  breakeven: '⚖️',
  closed_win: '💰',
  closed_partial: '💵',
  closed_loss: '❌',
  closed_breakeven: '➖',
  closed_manual: '✋',
  cancelled: '🚫'
}

sideEmoji: {
  LONG: '🟢',
  SHORT: '🔴',
  SPOT: '⚪'
}
```

#### trade.formatter.ts
**Propósito:** Formatear trades individuales

**Métodos:**
```typescript
formatForDisplay(trade: Trade): string
formatForList(trades: Trade[]): string
formatTradeRow(trade: Trade, index: number): string
```

**Origen:** `TradeFormatterService.formatForDisplay()`, `TradeFormatterService.formatForList()`

#### stats.formatter.ts
**Propósito:** Formatear estadísticas

**Métodos:**
```typescript
formatStats(stats: StatsData): string
```

**Origen:** `TradeFormatterService.formatStats()`

#### notification.formatter.ts
**Propósito:** Formatear notificaciones automáticas

**Métodos:**
```typescript
formatEntryTriggered(trade: Trade, price: number): string
formatTPHit(trade: Trade, tpIndex: number, rr: number): string
formatSLHit(trade: Trade, rr: number): string
formatSLTriggered(trade: Trade): string
formatTradeClosed(trade: Trade, reason: string): string
formatTradeCreated(trade: Trade): string
formatModification(trade: Trade, field: string, oldValue: unknown, newValue: unknown): string
formatPartialTP(trade: Trade, tpIndex: number, rr: number): string
formatBreakeven(trade: Trade): string
```

**Origen:** `NotificationTemplateService` (single-trade)

#### confirmation.formatter.ts
**Propósito:** Formatear mensajes de confirmación y edit mode

**Métodos:**
```typescript
formatConfirmation(trade: Trade, binanceInfo: BinanceInfoData): { text: string, buttons: InlineButtons }
formatEditMode(trade: Trade, binanceInfo: BinanceInfoData, tradeId: string): { text: string, buttons: InlineButtons }
formatTradeConfirmed(trade: Trade): string
formatTradeClosed(trade: Trade): string
formatTradeApproved(trade: Trade): string
```

**Origen:** `ConfirmationTemplateService` (trade-confirmation)

#### list.formatter.ts
**Propósito:** Formatear listas de trades

**Métodos:**
```typescript
formatTradeList(trades: Trade[], page: number, pageSize: number): string
formatTradeFull(trade: Trade): string
formatPagination(currentPage: number, totalPages: number): string
formatSummary(stats: ListStats): string
formatEmpty(): string
```

**Origen:** `TradeDisplayService`, `TradeListFormatterService` (trade-list)

#### display.formatter.ts
**Propósito:** Formateo genérico de display

**Métodos:**
```typescript
formatWelcome(): string
formatHelp(): string
formatStatus(status: TradeStatus): string
formatId(tradeId: string): string
formatHeader(title: string): string
```

**Origen:** `TradeFormatterService.formatWelcome()`, `TradeFormatterService.formatHelp()`

### Servicios a Mover

| Servicio Original | Destino en shared/ |
|------------------|-------------------|
| TradeFormatterService | display.formatter.ts + trade.formatter.ts + stats.formatter.ts |
| NotificationTemplateService | notification.formatter.ts |
| ConfirmationTemplateService | confirmation.formatter.ts |
| TradeDisplayService | list.formatter.ts |
| TradeListFormatterService | list.formatter.ts |

---

## Resumen de Cambios Propuestos

### Archivos a Mover a bot/
- `telegram/command/infrastructure/adapters/telegram-bot.adapter.ts` → `telegram/bot/infrastructure/telegraf.adapter.ts`

### Archivos a Mover a shared/formatters/
- `command/domain/services/trade-formatter.service.ts`
- `notification/single-trade/domain/services/notification-template.service.ts`
- `notification/trade-confirmation/domain/services/confirmation-template.service.ts`
- `notification/trade-list/domain/services/trade-display.service.ts`
- `notification/trade-list/domain/services/trade-list-formatter.service.ts`

### Puertos a Mover/Crear
- `TelegramPort` definir en `bot/domain/ports/` (UNICO)
- Eliminar re-export en `trade-list/domain/ports/telegram.port.ts`

### Adapters a Consolidar
- `TelegramMessageAdapter` (single-trade) y `TelegramMessageAdapter` (trade-list) → UNO solo en `bot/infrastructure/adapters/`

### Servicios a Mover
| Servicio | Nuevo Destino |
|----------|--------------|
| ValidationService | command/domain/services/ |
| CommandRouterService | command/domain/services/ |
| EditStateManager | confirmation/domain/services/ |
| BinanceInfoService | confirmation/domain/services/ |
| NotificationBatcherService | notification/domain/services/ |
| TradeListCacheService | notification/domain/services/ |

### Command Handlers a Reorganizar
- Todos los handlers de command/ se quedan en command/
- Todos los event-handlers de notification/ se mueven a notification/
- Todos los commands de trade-confirmation/ se mueven a confirmation/

---

## Problemas a Resolver

1. **TelegramPort duplicado** - definido en single-trade, re-exportado en trade-list
2. **TelegramMessageAdapter duplicado** - mismo código en single-trade y trade-list
3. **Emoji mappings duplicados** - 4+ veces el mismo getStatusEmoji()
4. **StateChangedEvent duplicado** - escuchado por 2 handlers diferentes con lógica similar
5. **Ports sin usar** - CommandPort, StatePort, NotificationPort nunca implementados

---

*Documento en construcción - actualizado con análisis completo de archivos existentes*