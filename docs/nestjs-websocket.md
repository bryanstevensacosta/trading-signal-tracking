# NestJS WebSocket Gateway

NestJS provides `@nestjs/websockets` for WebSocket communication, ideal for Binance real-time prices.

## Installation

```bash
npm install @nestjs/websockets @nestjs/platform-ws
```

## Basic Gateway

```typescript
// price-stream.gateway.ts
@WebSocketGateway()
export class PriceStreamGateway {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }
}
```

## Subscribe to Events

```typescript
@WebSocketGateway()
export class PriceStreamGateway {
  @WebSocketSubscription('price/update')
  handlePriceUpdate(data: PriceData): void {
    // Handle price update from Binance
  }
}
```

## Broadcasting

### Emit to All Clients

```typescript
@WebSocketGateway()
export class PriceStreamGateway {
  private server: Server;

  broadcastPrice(symbol: string, price: number) {
    this.server.emit('price:update', { symbol, price });
  }
}
```

### Emit to Room

```typescript
@WebSocketGateway()
export class PriceStreamGateway {
  @SubscribeMessage('join-room')
  handleJoinRoom(client: Socket, room: string): void {
    client.join(room);
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(client: Socket, room: string): void {
    client.leave(room);
  }

  emitToRoom(room: string, event: string, data: any): void {
    this.server.to(room).emit(event, data);
  }
}
```

## WebSocket Gateway Options

```typescript
@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/price',
  pingInterval: 25000,
  pingTimeout: 20000,
})
export class PriceStreamGateway {}
```

## Message Patterns

### Subscribe to Symbol

```typescript
@SubscribeMessage('subscribe')
handleSubscribe(client: Socket, payload: { symbols: string[] }): void {
  payload.symbols.forEach(symbol => {
    client.join(`symbol:${symbol}`);
  });
  this.server.to(client.id).emit('subscribed', payload.symbols);
}
```

### Unsubscribe from Symbol

```typescript
@SubscribeMessage('unsubscribe')
handleUnsubscribe(client: Socket, payload: { symbols: string[] }): void {
  payload.symbols.forEach(symbol => {
    client.leave(`symbol:${symbol}`);
  });
}
```

## Binance WebSocket Integration

```typescript
@WebSocketGateway()
export class PriceStreamGateway implements OnModuleInit, OnModuleDestroy {
  private ws: WebSocket;
  private reconnectAttempts = 0;

  onModuleInit() {
    this.connect();
  }

  onModuleDestroy() {
    this.ws?.close();
  }

  private connect(): void {
    this.ws = new WebSocket('wss://stream.binance.com:9443/ws');

    this.ws.on('open', () => {
      console.log('Connected to Binance WebSocket');
      this.reconnectAttempts = 0;
      this.subscribe(['btcusdt@ ticker', 'ethusdt@ticker']);
    });

    this.ws.on('message', (data: WebSocket.RawData) => {
      const message = JSON.parse(data.toString());
      this.handleBinanceMessage(message);
    });

    this.ws.on('close', () => {
      this.reconnect();
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  private handleBinanceMessage(data: any): void {
    if (data.e === '24hrTicker') {
      const price = {
        symbol: data.s,
        bid: parseFloat(data.b),
        ask: parseFloat(data.a),
        last: parseFloat(data.c),
        timestamp: new Date(data.E),
      };

      // Broadcast to room
      this.server.to(`symbol:${price.symbol}`).emit('price:update', price);
    }
  }

  private subscribe(symbols: string[]): void {
    this.ws.send(JSON.stringify({
      method: 'SUBSCRIBE',
      params: symbols,
      id: Date.now(),
    }));
  }

  private reconnect(): void {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    setTimeout(() => {
      console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
      this.connect();
    }, delay);
  }
}
```

## Client Example

```typescript
// client.ts
const ws = new WebSocket('ws://localhost:3000/price');

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Price update:', message);
});

// Subscribe to symbols
ws.send(JSON.stringify({
  event: 'subscribe',
  symbols: ['BTCUSDT', 'ETHUSDT'],
}));
```

## Rooms by Symbol

```typescript
@WebSocketGateway()
export class PriceStreamGateway {
  private symbolRooms = new Map<string, Set<string>>();

  @SubscribeMessage('subscribe-symbol')
  handleSubscribeSymbol(client: Socket, symbol: string): void {
    const normalizedSymbol = symbol.toUpperCase();
    client.join(`symbol:${normalizedSymbol}`);

    if (!this.symbolRooms.has(normalizedSymbol)) {
      this.symbolRooms.set(normalizedSymbol, new Set());
    }
    this.symbolRooms.get(normalizedSymbol).add(client.id);

    console.log(`Client ${client.id} subscribed to ${normalizedSymbol}`);
  }

  @SubscribeMessage('unsubscribe-symbol')
  handleUnsubscribeSymbol(client: Socket, symbol: string): void {
    const normalizedSymbol = symbol.toUpperCase();
    client.leave(`symbol:${normalizedSymbol}`);

    this.symbolRooms.get(normalizedSymbol)?.delete(client.id);
  }

  broadcastToSymbol(symbol: string, data: any): void {
    this.server.to(`symbol:${symbol}`).emit('price:update', data);
  }
}
```

## Error Handling

```typescript
@WebSocketGateway()
export class PriceStreamGateway {
  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, payload: any): WsResponse<string> {
    try {
      // Subscribe logic
      return { event: 'subscribed', data: 'OK' };
    } catch (error) {
      return { event: 'error', data: error.message };
    }
  }

  handleError(client: Socket, error: Error): void {
    console.error(`Error for client ${client.id}:`, error);
  }
}
```

## Gateway Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `namespace` | string | `/` | WebSocket namespace |
| `path` | string | `/ws` | Path for WebSocket |
| `cors` | object | - | CORS configuration |
| `pingInterval` | number | 25000 | Ping interval in ms |
| `pingTimeout` | number | 20000 | Ping timeout in ms |
| `transports` | array | `['websocket']` | Transport types |

## Summary

| Feature | Usage |
|---------|-------|
| `@WebSocketGateway()` | Define WebSocket gateway |
| `@WebSocketServer()` | Inject server instance |
| `@SubscribeMessage()` | Handle client messages |
| `client.join(room)` | Join room |
| `client.leave(room)` | Leave room |
| `server.to(room).emit()` | Broadcast to room |
| `broadcastToAll()` | Broadcast to all |