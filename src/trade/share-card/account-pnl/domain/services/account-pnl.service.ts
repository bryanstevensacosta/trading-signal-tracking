import { Injectable } from '@nestjs/common';
import { AccountCardInput, AccountCardData } from '@trade/share-card/common/types';

@Injectable()
export class AccountPnlService {
  computeAccountCardData(input: AccountCardInput): AccountCardData {
    const {
      totalTrades,
      winningTrades,
      losingTrades,
      totalPnL,
      activePositions,
      periodPnL,
      periodLabel,
    } = input;

    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const isProfitable = totalPnL > 0;

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      totalPnL,
      totalPnLFormatted: this.formatPnL(totalPnL),
      activePositions,
      periodPnL,
      periodPnLFormatted: this.formatPnL(periodPnL),
      periodLabel,
      isProfitable,
    };
  }

  private formatPnL(value: number): string {
    const sign = value >= 0 ? '+' : '';
    if (Math.abs(value) >= 1_000_000) {
      return `${sign}$${(value / 1_000_000).toFixed(2)}M`;
    }
    if (Math.abs(value) >= 1_000) {
      return `${sign}$${(value / 1_000).toFixed(1)}K`;
    }
    return `${sign}$${value.toFixed(2)}`;
  }
}