import { Injectable } from '@nestjs/common';
import { TradeStatus, TradeSide } from '@trade/shared/types';
import { PositionCardInput, PositionCardData } from '@trade/share-card/common/types';
import { calculateR, calculateRR, calculatePnL, calculatePnLPercent } from '@trade/shared/helpers';

@Injectable()
export class PositionPnlService {
  computePositionCardData(input: PositionCardInput): PositionCardData {
    const {
      symbol,
      side,
      entry,
      currentPrice,
      sl,
      tps,
      tpsHit,
      status,
    } = input;

    const movementPercent = this.calculateMovement(entry, currentPrice, side);
    const pnlAmount = calculatePnL(entry, currentPrice, side);
    const pnlPercent = calculatePnLPercent(entry, currentPrice, side);

    const rrToSL = sl ? this.calculateRRToSL(entry, sl, side) : null;
    const { rrToNextTP, nextTP } = this.calculateRRToNextTP(
      entry,
      sl,
      tps,
      tpsHit,
      side,
    );

    const isWinning = pnlAmount > 0 || status === 'closed_win';

    return {
      symbol,
      side,
      entry,
      currentPrice,
      sl,
      movementPercent,
      pnlAmount,
      pnlPercent,
      rrToSL,
      rrToNextTP,
      nextTP,
      status,
      statusLabel: this.getStatusLabel(status),
      isWinning,
    };
  }

  private calculateMovement(
    entry: number,
    currentPrice: number,
    side: TradeSide,
  ): number {
    if (side === TradeSide.LONG || side === TradeSide.SPOT) {
      return ((currentPrice - entry) / entry) * 100;
    }
    return ((entry - currentPrice) / entry) * 100;
  }

  private calculateRRToSL(
    entry: number,
    sl: number,
    side: TradeSide,
  ): number {
    const r = calculateR(entry, sl);
    if (r === 0) return 0;

    const currentPnL = calculatePnL(entry, entry + r * 0.5, side);
    const rr = currentPnL / r;

    return side === TradeSide.SHORT ? -rr : rr;
  }

  private calculateRRToNextTP(
    entry: number,
    sl: number | null,
    tps: number[],
    tpsHit: number[],
    side: TradeSide,
  ): { rrToNextTP: number | null; nextTP: number | null } {
    if (!sl || !tps || tps.length === 0) {
      return { rrToNextTP: null, nextTP: null };
    }

    const nextTPIndex = tpsHit.length;
    const nextTPPrice = tps[nextTPIndex];

    if (!nextTPPrice) {
      return { rrToNextTP: null, nextTP: null };
    }

    const rr = calculateRR(entry, sl, nextTPPrice, side);

    return {
      rrToNextTP: rr,
      nextTP: nextTPPrice,
    };
  }

  private getStatusLabel(status: TradeStatus): string {
    const labels: Record<string, string> = {
      [TradeStatus.PENDING]: 'Pendiente',
      [TradeStatus.ACTIVE]: 'Activo',
      [TradeStatus.PARTIAL_TP]: 'TP Parcial',
      [TradeStatus.BREAKEVEN]: 'Breakeven',
      [TradeStatus.CLOSED_WIN]: 'Ganado',
      [TradeStatus.CLOSED_PARTIAL]: 'Parcial',
      [TradeStatus.CLOSED_LOSS]: 'Perdido',
      [TradeStatus.CLOSED_BREAKEVEN]: 'BE',
      [TradeStatus.CLOSED_MANUAL]: 'Cerrado',
      [TradeStatus.CANCELLED]: 'Cancelado',
    };
    return labels[status] || status;
  }
}