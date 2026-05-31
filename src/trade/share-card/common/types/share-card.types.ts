import { TradeStatus, TradeSide } from '@trade/shared';

/**
 * Color scheme for share cards.
 */
export interface CardTheme {
  colors: {
    primary: string;
    success: string;
    danger: string;
    warning: string;
    text: string;
    textMuted: string;
    background: string;
    card: string;
    border: string;
  };
  fonts: {
    primary: string;
    mono: string;
  };
  borderRadius: number;
}

/**
 * Base configuration for share cards.
 */
export interface CardConfig {
  width: number;
  height: number;
  theme: CardTheme;
}

/**
 * Input data for generating a position PNL card.
 */
export interface PositionCardInput {
  symbol: string;
  side: TradeSide;
  entry: number;
  currentPrice: number;
  sl: number | null;
  tps: number[];
  tpsHit: number[];
  status: TradeStatus;
}

/**
 * Computed data for position PNL card.
 */
export interface PositionCardData {
  symbol: string;
  side: TradeSide;
  entry: number;
  currentPrice: number;
  sl: number | null;
  movementPercent: number;
  pnlAmount: number;
  pnlPercent: number;
  rrToSL: number | null;
  rrToNextTP: number | null;
  nextTP: number | null;
  status: TradeStatus;
  statusLabel: string;
  isWinning: boolean;
}

/**
 * Input data for generating an account PNL card.
 */
export interface AccountCardInput {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  activePositions: number;
  periodPnL: number;
  periodLabel: string;
}

/**
 * Computed data for account PNL card.
 */
export interface AccountCardData {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  totalPnLFormatted: string;
  activePositions: number;
  periodPnL: number;
  periodPnLFormatted: string;
  periodLabel: string;
  isProfitable: boolean;
}

/**
 * Output result from card generation.
 */
export interface CardResult {
  buffer: Buffer;
  format: 'png' | 'jpeg';
  width: number;
  height: number;
}