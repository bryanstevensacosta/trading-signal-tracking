# Trade Context - Q&A for Consolidation

## Q1: ¿Dónde debe estar la lógica de trigger detection?

**Opción A**: En `trade/state` (como está ahora)
**Opción B**: En `trade/engine` (nuevo)
**Opción C**: En ambos (duplicado)

**Recomendación**: Opción B - Solo en `trade/engine`

**Razón**: El engine es quien monitorea precios, tiene sentido que detecte triggers. trade/state solo ejecuta transiciones.

---

## Q2: ¿Debe trade/repository definir TradeStatus?

**Opción A**: Sí, lo define para uso local
**Opción B**: No, debe importarlo de un módulo compartido

**Recomendación**: Opción B - Importar desde `trade/state` o módulo común

**Razón**: Evitar duplicación. Un solo lugar para el enum.

---

## Q3: ¿Cuántos puertos de precio necesitamos?

**Opción A**: Uno unificado (PricePort)
**Opción B**: Dos separados (PricePort en state, PriceSubscriptionPort en engine)

**Recomendación**: Opción A - Unificar como `PricePort`

**Puertos propuestos**:
```typescript
interface PricePort {
  subscribe(symbols: string[]): void;
  unsubscribe(symbols: string[]): void;
  getPrice(symbol: string): Price | null;
  onPriceUpdate(callback: (price: Price) => void): void;
}
```

---

## Q4: ¿Qué debe hacer trade/state?

**Opción A**: Todo (transitions + modifications + triggers)
**Opción B**: Solo transiciones de estado
**Opción C**: Transiciones + validaciones

**Recomendación**: Opción B - Solo transiciones

** trade/state sería simplemente:
- `transitionState(tradeId, newStatus, reason)`
- Validar transición válida
- Emitir evento

---

## Q5: ¿Quién maneja las modificaciones (Entry, SL, TP)?

**Opción A**: trade/state
**Opción B**: telegram/command
**Opción C**: Nuevo trade/modifications

**Recomendación**: Opción B - telegram/command

**Razón**: Las modificaciones vienen de comandos de usuario, no de triggers automáticos.

---

## Q6: ¿Deben monitorearse trades en estado "pending"?

**Opción A**: Sí, para detectar entry hit
**Opción B**: No, solo activos

**Recomendación**: Opción A

**Razón**: Para que entry hit sea detectado, el trade debe ser monitoreado desde pending.

---

## Q7: ¿Necesitamos un módulo común/shared?

**Opción A**: Sí, para enums, types
**Opción B**: No, cada BC define lo que necesita

**Recomendación**: Opción A

**Módulos compartidos sugeridos**:
```
src/trade/shared/
├── types/
│   └── trade.types.ts    (Trade, TradeStatus, etc.)
├── events/
│   └── trade.events.ts  (eventos comunes)
└── constants/
    └── trade.constants.ts
```

---

## Q8: ¿Cuántos eventos necesitamos?

**Evento** | **Emisor** | **Suscriptores**
---|---|---
TradeCreatedEvent | trade/ingestion | trade/repository, trade/state
StateChangedEvent | trade/state | telegram/notification, trade-list
PriceUpdatedEvent | price/stream | trade/engine, price/cache
TriggerDetectedEvent | trade/engine | trade/state
NotificationEvent | trade/state | telegram/notification

---

## Resumen de Decisiones

| Pregunta | Decisión |
|----------|-----------|
| Q1: Trigger detection | Solo en `trade/engine` |
| Q2: TradeStatus | Importar de módulo compartido |
| Q3: Puertos de precio | Unificar en `PricePort` |
| Q4: Responsabilidad state | Solo transiciones |
| Q5: Modifications | `telegram/command` |
| Q6: Monitor pending | Sí |
| Q7: Módulo compartido | Sí, crear |
| Q8: Eventos | Ver tabla arriba |