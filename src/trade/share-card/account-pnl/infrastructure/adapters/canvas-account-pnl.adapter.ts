import { Injectable, Logger } from '@nestjs/common';
import { createCanvas, CanvasRenderingContext2D } from '@napi-rs/canvas';
import { AccountCardData, CardResult, CardTheme } from '@trade/share-card/common/types';
import {
  ACCOUNT_CARD_CONFIG,
  CARD_PADDING,
} from '@trade/share-card/common/constants';

type CanvasContext = CanvasRenderingContext2D;

@Injectable()
export class CanvasAccountPnlAdapter {
  private readonly logger = new Logger(CanvasAccountPnlAdapter.name);

  async generateCard(
    data: AccountCardData,
    theme?: CardTheme,
  ): Promise<CardResult> {
    const config = ACCOUNT_CARD_CONFIG;
    const themeToUse = theme || config.theme;

    const canvas = createCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');

    this.drawBackground(ctx, config.width, config.height, themeToUse);
    this.drawHeader(ctx, data, config.width, themeToUse);
    this.drawTotalPnL(ctx, data, config.width, themeToUse);
    this.drawPeriodPnL(ctx, data, config.width, themeToUse);
    this.drawStats(ctx, data, config.width, themeToUse);
    this.drawWinRate(ctx, data, config.width, themeToUse);

    const buffer = await canvas.encode('png');

    return {
      buffer,
      format: 'png',
      width: config.width,
      height: config.height,
    };
  }

  private drawBackground(
    ctx: CanvasContext,
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
    ctx: CanvasContext,
    data: AccountCardData,
    width: number,
    theme: CardTheme,
  ): void {
    const x = CARD_PADDING;
    const y = CARD_PADDING + 8;

    ctx.fillStyle = theme.colors.text;
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.fillText('ACCOUNT PNL', x, y);

    const date = new Date().toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
    });
    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = theme.colors.textMuted;
    ctx.fillText(date, x + 180, y);
  }

  private drawTotalPnL(
    ctx: CanvasContext,
    data: AccountCardData,
    width: number,
    theme: CardTheme,
  ): void {
    const x = CARD_PADDING;
    const y = CARD_PADDING + 70;

    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = theme.colors.textMuted;
    ctx.fillText('TOTAL PNL', x, y);

    ctx.font = 'bold 42px "JetBrains Mono", monospace';
    const pnlColor = data.totalPnL >= 0 ? theme.colors.success : theme.colors.danger;
    ctx.fillStyle = pnlColor;
    ctx.fillText(data.totalPnLFormatted, x, y + 50);
  }

  private drawPeriodPnL(
    ctx: CanvasContext,
    data: AccountCardData,
    width: number,
    theme: CardTheme,
  ): void {
    const x = CARD_PADDING;
    const y = CARD_PADDING + 150;

    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = theme.colors.textMuted;
    ctx.fillText(`${data.periodLabel.toUpperCase()} PNL`, x, y);

    ctx.font = 'bold 28px "JetBrains Mono", monospace';
    const pnlColor = data.periodPnL >= 0 ? theme.colors.success : theme.colors.danger;
    ctx.fillStyle = pnlColor;
    ctx.fillText(data.periodPnLFormatted, x, y + 35);
  }

  private drawStats(
    ctx: CanvasContext,
    data: AccountCardData,
    width: number,
    theme: CardTheme,
  ): void {
    const x = width / 2;
    const y = CARD_PADDING + 70;

    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = theme.colors.textMuted;
    ctx.fillText('TOTAL TRADES', x, y);

    ctx.font = 'bold 32px "JetBrains Mono", monospace';
    ctx.fillStyle = theme.colors.text;
    ctx.fillText(data.totalTrades.toString(), x, y + 38);

    const activeY = y + 60;
    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = theme.colors.textMuted;
    ctx.fillText('ACTIVE POSITIONS', x, activeY);

    ctx.font = 'bold 24px "JetBrains Mono", monospace';
    ctx.fillStyle = theme.colors.primary;
    ctx.fillText(data.activePositions.toString(), x, activeY + 30);
  }

  private drawWinRate(
    ctx: CanvasContext,
    data: AccountCardData,
    width: number,
    theme: CardTheme,
  ): void {
    const x = CARD_PADDING;
    const y = CARD_PADDING + 220;

    const barWidth = width - CARD_PADDING * 2;
    const barHeight = 12;
    const winWidth = (data.winRate / 100) * barWidth;

    ctx.fillStyle = theme.colors.card;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, 6);
    ctx.fill();

    ctx.fillStyle = theme.colors.success;
    ctx.beginPath();
    ctx.roundRect(x, y, winWidth, barHeight, 6);
    ctx.fill();

    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.fillStyle = theme.colors.text;
    ctx.fillText(`${data.winRate.toFixed(1)}% WIN RATE`, x, y + 35);

    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = theme.colors.textMuted;
    ctx.fillText(`${data.winningTrades}W / ${data.losingTrades}L`, x + 130, y + 35);
  }
}