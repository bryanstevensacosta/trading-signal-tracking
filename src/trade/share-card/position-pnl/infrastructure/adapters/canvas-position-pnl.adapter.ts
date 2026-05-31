import { Injectable, Logger } from '@nestjs/common';
import { createCanvas } from '@napi-rs/canvas';
import { PositionCardData, CardResult, CardTheme } from '@trade/share-card/common/types';
import {
  POSITION_CARD_CONFIG,
  CARD_PADDING,
} from '@trade/share-card/common/constants';

@Injectable()
export class CanvasPositionPnlAdapter {
  private readonly logger = new Logger(CanvasPositionPnlAdapter.name);

  async generateCard(
    data: PositionCardData,
    theme?: CardTheme,
  ): Promise<CardResult> {
    const config = POSITION_CARD_CONFIG;
    const themeToUse = theme || config.theme;

    const canvas = createCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');

    this.drawBackground(ctx, config.width, config.height, themeToUse);
    this.drawHeader(ctx, data, config.width, themeToUse);
    this.drawPrices(ctx, data, config.width, themeToUse);
    this.drawPnL(ctx, data, config.width, themeToUse);
    this.drawRR(ctx, data, config.width, themeToUse);
    this.drawStatusBadge(ctx, data, config.width, themeToUse);

    const buffer = await canvas.encode('png');

    return {
      buffer,
      format: 'png',
      width: config.width,
      height: config.height,
    };
  }

  private drawBackground(
    ctx: any,
    width: number,
    height: number,
    theme: CardTheme,
  ): void {
    ctx.fillStyle = theme.colors.background;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = theme.colors.card;
    ctx.beginPath();
    ctx.roundRect(8, 8, width - 16, height - 16, 16);
    ctx.fill();

    ctx.strokeStyle = theme.colors.border;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private drawHeader(
    ctx: any,
    data: PositionCardData,
    width: number,
    theme: CardTheme,
  ): void {
    const x = CARD_PADDING;
    const y = CARD_PADDING + 8;

    ctx.fillStyle = theme.colors.text;
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.fillText(data.symbol, x, y);

    const sideLabel = data.side === 'LONG' ? 'LONG' : data.side === 'SHORT' ? 'SHORT' : 'SPOT';
    const sideColor = data.side === 'LONG' ? theme.colors.success : theme.colors.danger;

    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillStyle = sideColor;
    ctx.fillText(sideLabel, x + ctx.measureText(data.symbol).width + 12, y);
  }

  private drawPrices(
    ctx: any,
    data: PositionCardData,
    width: number,
    theme: CardTheme,
  ): void {
    const x = CARD_PADDING;
    let y = CARD_PADDING + 60;

    ctx.font = '13px Inter, sans-serif';
    ctx.fillStyle = theme.colors.textMuted;
    ctx.fillText('ENTRY', x, y);

    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.fillStyle = theme.colors.text;
    ctx.fillText(this.formatPrice(data.entry), x, y + 22);

    y += 50;

    ctx.font = '13px Inter, sans-serif';
    ctx.fillStyle = theme.colors.textMuted;
    ctx.fillText('CURRENT', x, y);

    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    const priceColor = data.movementPercent >= 0 ? theme.colors.success : theme.colors.danger;
    ctx.fillStyle = priceColor;
    ctx.fillText(this.formatPrice(data.currentPrice), x, y + 22);

    if (data.nextTP) {
      y += 50;
      ctx.font = '13px Inter, sans-serif';
      ctx.fillStyle = theme.colors.textMuted;
      ctx.fillText('NEXT TP', x, y);

      ctx.font = 'bold 18px "JetBrains Mono", monospace';
      ctx.fillStyle = theme.colors.primary;
      ctx.fillText(this.formatPrice(data.nextTP), x, y + 20);
    }

    if (data.status !== 'closed_win' && data.status !== 'closed_loss' && data.sl) {
      const slX = width - CARD_PADDING - 100;
      const slY = CARD_PADDING + 60;

      ctx.font = '13px Inter, sans-serif';
      ctx.fillStyle = theme.colors.textMuted;
      ctx.fillText('STOP LOSS', slX, slY);

      ctx.font = 'bold 18px "JetBrains Mono", monospace';
      ctx.fillStyle = theme.colors.danger;
      ctx.fillText(this.formatPrice(data.sl), slX, slY + 22);
    }
  }

  private drawPnL(
    ctx: any,
    data: PositionCardData,
    width: number,
    theme: CardTheme,
  ): void {
    const x = width - CARD_PADDING - 180;
    const y = CARD_PADDING + 130;

    ctx.font = '13px Inter, sans-serif';
    ctx.fillStyle = theme.colors.textMuted;
    ctx.fillText('PNL', x, y);

    ctx.font = 'bold 24px "JetBrains Mono", monospace';
    const pnlColor = data.pnlAmount >= 0 ? theme.colors.success : theme.colors.danger;
    ctx.fillStyle = pnlColor;
    ctx.fillText(this.formatPnL(data.pnlAmount), x, y + 28);

    ctx.font = '16px "JetBrains Mono", monospace';
    ctx.fillText(`(${this.formatPercent(data.pnlPercent)})`, x, y + 48);
  }

  private drawRR(
    ctx: any,
    data: PositionCardData,
    width: number,
    theme: CardTheme,
  ): void {
    const x = CARD_PADDING;
    const y = CARD_PADDING + 165;

    ctx.font = '13px Inter, sans-serif';
    ctx.fillStyle = theme.colors.textMuted;
    ctx.fillText('MOVEMENT', x, y);

    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.fillStyle = theme.colors.text;
    ctx.fillText(this.formatPercent(data.movementPercent), x, y + 24);

    if (data.rrToNextTP !== null) {
      const rrX = x + 120;

      ctx.font = '13px Inter, sans-serif';
      ctx.fillStyle = theme.colors.textMuted;
      ctx.fillText('RR', rrX, y);

      ctx.font = 'bold 18px "JetBrains Mono", monospace';
      ctx.fillStyle = theme.colors.warning;
      ctx.fillText(`${data.rrToNextTP.toFixed(2)}R`, rrX, y + 24);
    }
  }

  private drawStatusBadge(
    ctx: any,
    data: PositionCardData,
    width: number,
    theme: CardTheme,
  ): void {
    const x = width - CARD_PADDING - 60;
    const y = CARD_PADDING + 8;

    let bgColor: string;
    const textColor = '#fff';

    switch (data.status) {
      case 'closed_win':
      case 'active':
        bgColor = theme.colors.success;
        break;
      case 'closed_loss':
        bgColor = theme.colors.danger;
        break;
      case 'partial_tp':
        bgColor = theme.colors.warning;
        break;
      case 'breakeven':
        bgColor = theme.colors.primary;
        break;
      default:
        bgColor = theme.colors.textMuted;
    }

    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(x, y, 52, 26, 13);
    ctx.fill();

    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.fillText(data.statusLabel.toUpperCase(), x + 26, y + 18);
    ctx.textAlign = 'left';
  }

  private formatPrice(price: number): string {
    if (price >= 1000) {
      return price.toFixed(2);
    }
    if (price >= 1) {
      return price.toFixed(4);
    }
    return price.toFixed(6);
  }

  private formatPnL(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}`;
  }

  private formatPercent(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }
}