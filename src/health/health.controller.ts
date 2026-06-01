import { Controller, Get, Param } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { PriceStreamService } from '@price/stream/domain/services/price-stream.service';
import { TriggerOrchestratorService } from '@trade/trigger/domain/services/trigger-orchestrator.service';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '@trade/repository/domain/ports/trade-repository.port';

@Controller('health')
export class HealthController {
  constructor(
    private readonly priceStream: PriceStreamService,
    private readonly engine: TriggerOrchestratorService,
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
  ) {}

  @Get()
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('subscriptions')
  getSubscriptions() {
    const symbols = this.priceStream.getActiveSubscriptions();
    return {
      symbols,
      count: symbols.length,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('subscriptions/:symbol')
  getSymbolSubscription(@Param('symbol') symbol: string) {
    const upper = symbol.toUpperCase();
    return {
      symbol: upper,
      subscribed: this.priceStream.isSubscribed(upper),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('monitoring')
  getMonitoring() {
    const symbols = this.engine.getMonitoredSymbols();
    return {
      symbols,
      count: symbols.length,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('monitoring/:symbol')
  getSymbolMonitoring(@Param('symbol') symbol: string) {
    const upper = symbol.toUpperCase();
    return {
      symbol: upper,
      monitored: this.engine.isMonitoring(upper),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('trades')
  async getActiveTrades() {
    const trades = await this.repository.findActive();
    return {
      trades: trades.map(t => ({
        id: t.id,
        symbol: t.symbol,
        side: t.side,
        status: t.status,
        entry: t.entry,
        entryExecutedPrice: t.entryExecutedPrice,
        sl: t.sl,
        tps: t.tps,
        tpsHit: t.tpsHit,
      })),
      count: trades.length,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('trade/:id')
  async getTrade(@Param('id') id: string) {
    const trade = await this.repository.findById(id);
    if (!trade) {
      return { error: 'Trade not found', id };
    }

    const priceSubscriptions = this.priceStream.getActiveSubscriptions();
    const isSymbolSubscribed = priceSubscriptions.includes(trade.symbol.toUpperCase());
    const isSymbolMonitored = this.engine.isMonitoring(trade.symbol.toUpperCase());

    return {
      trade: {
        id: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        status: trade.status,
        entry: trade.entry,
        entryExecutedPrice: trade.entryExecutedPrice,
        entryExecutedAt: trade.entryExecutedAt,
        sl: trade.sl,
        tps: trade.tps,
        tpsHit: trade.tpsHit,
        sourceMessage: trade.sourceMessage,
        createdAt: trade.createdAt,
        updatedAt: trade.updatedAt,
      },
      monitoring: {
        symbolSubscribed: isSymbolSubscribed,
        symbolMonitored: isSymbolMonitored,
        activePriceSubscriptions: priceSubscriptions,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
