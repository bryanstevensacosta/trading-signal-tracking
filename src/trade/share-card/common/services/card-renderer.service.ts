import { Injectable } from '@nestjs/common';
import { CanvasRenderingContext2D } from '@napi-rs/canvas';
import { CardConfig, CardTheme } from '@trade/share-card/common/types';
import {
  CARD_PADDING,
  CARD_SPACING,
  CARD_SPACING_SMALL,
  DARK_THEME,
} from '@trade/share-card/common/constants';

/**
 * Base service for rendering share cards.
 * Provides common rendering utilities.
 */
@Injectable()
export class CardRendererService {
  protected config: CardConfig;
  protected ctx: CanvasRenderingContext2D;

  /**
   * Sets up the canvas context for rendering.
   */
  protected setupCanvas(width: number, height: number, theme?: CardTheme): void {
    this.config = {
      width,
      height,
      theme: theme || DARK_THEME,
    };
  }

  /**
   * Formats a number as currency.
   */
  formatCurrency(value: number, decimals: number = 2): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(decimals)}`;
  }

  /**
   * Formats a number as percentage.
   */
  formatPercent(value: number, decimals: number = 2): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(decimals)}%`;
  }

  /**
   * Formats a number with K/M suffix for large numbers.
   */
  formatCompact(value: number): string {
    if (Math.abs(value) >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1_000) {
      return `${(value / 1_000).toFixed(1)}K`;
    }
    return value.toFixed(2);
  }

  /**
   * Gets the appropriate color for a value (positive/negative).
   */
  getValueColor(value: number, theme: CardTheme): string {
    if (value > 0) return theme.colors.success;
    if (value < 0) return theme.colors.danger;
    return theme.colors.textMuted;
  }

  /**
   * Gets the status label for a trade status.
   */
  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      active: 'Activo',
      partial_tp: 'TP Parcial',
      breakeven: 'Breakeven',
      closed_win: 'Ganado',
      closed_partial: 'Parcial',
      closed_loss: 'Perdido',
      closed_breakeven: 'BE',
      closed_manual: 'Cerrado',
      cancelled: 'Cancelado',
    };
    return labels[status] || status;
  }

  /**
   * Draws a rounded rectangle.
   */
  protected drawRoundedRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }

  /**
   * Draws text with optional background.
   */
  protected drawTextWithBackground(
    text: string,
    x: number,
    y: number,
    options: {
      font?: string;
      color?: string;
      bgColor?: string;
      padding?: number;
      radius?: number;
    } = {},
  ): void {
    const {
      font = '16px Inter',
      color = '#fff',
      bgColor = null,
      padding = 8,
      radius = 4,
    } = options;

    this.ctx.font = font;
    const metrics = this.ctx.measureText(text);
    const textHeight = 16;
    const width = metrics.width + padding * 2;
    const height = textHeight + padding * 2;

    if (bgColor) {
      this.ctx.fillStyle = bgColor;
      this.drawRoundedRect(x, y - textHeight - padding, width, height, radius);
      this.ctx.fill();
    }

    this.ctx.fillStyle = color;
    this.ctx.fillText(text, x + padding, y);
  }

  /**
   * Draws a horizontal line separator.
   */
  protected drawSeparator(y: number, color: string = '#334155'): void {
    this.ctx.beginPath();
    this.ctx.moveTo(CARD_PADDING, y);
    this.ctx.lineTo(this.config.width - CARD_PADDING, y);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }

  /**
   * Gets padding constant.
   */
  protected getPadding(): number {
    return CARD_PADDING;
  }

  /**
   * Gets spacing constant.
   */
  protected getSpacing(): number {
    return CARD_SPACING;
  }

  /**
   * Gets small spacing constant.
   */
  protected getSpacingSmall(): number {
    return CARD_SPACING_SMALL;
  }
}