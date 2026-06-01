import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GenerateAccountPnlCommand } from './command';
import { AccountPnlService } from '@trade/share-card/account-pnl/domain/services/account-pnl.service';
import { CanvasAccountPnlAdapter } from '@trade/share-card/account-pnl/infrastructure/adapters/canvas-account-pnl.adapter';
import { DARK_THEME, LIGHT_THEME } from '@trade/share-card/common/constants';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '@trade/repository/domain/ports';
import { Trade, TradeStatus } from '@trade/shared/types';

const CLOSED_STATUSES = [
  TradeStatus.CLOSED_WIN,
  TradeStatus.CLOSED_PARTIAL,
  TradeStatus.CLOSED_LOSS,
  TradeStatus.CLOSED_BREAKEVEN,
  TradeStatus.CLOSED_MANUAL,
];

const ACTIVE_STATUSES = [
  TradeStatus.PENDING,
  TradeStatus.ACTIVE,
  TradeStatus.PARTIAL_TP,
  TradeStatus.BREAKEVEN,
];

export class GenerateAccountPnlCommandResponse {
  constructor(
    public readonly buffer: Buffer,
    public readonly format: string,
    public readonly width: number,
    public readonly height: number,
  ) {}
}

@CommandHandler(GenerateAccountPnlCommand)
export class GenerateAccountPnlHandler
  implements ICommandHandler<GenerateAccountPnlCommand>
{
  constructor(
    private readonly accountPnlService: AccountPnlService,
    private readonly canvasAdapter: CanvasAccountPnlAdapter,
    @Inject(TRADE_REPOSITORY_PORT) private readonly tradeRepository: TradeRepositoryPort,
  ) {}

  async execute(
    command: GenerateAccountPnlCommand,
  ): Promise<GenerateAccountPnlCommandResponse> {
    const allTrades = await this.tradeRepository.findAll();

    const closedTrades = allTrades.filter(t => CLOSED_STATUSES.includes(t.status));
    const activeTrades = allTrades.filter(t => ACTIVE_STATUSES.includes(t.status));
    const winningTrades = closedTrades.filter(t => t.status === TradeStatus.CLOSED_WIN);
    const losingTrades = closedTrades.filter(t => t.status === TradeStatus.CLOSED_LOSS);

    const totalPnL = this.calculateTotalPnL(closedTrades);
    const periodPnL = this.calculatePeriodPnL(closedTrades, command.periodLabel);

    const accountInput = {
      totalTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      totalPnL,
      activePositions: activeTrades.length,
      periodPnL,
      periodLabel: command.periodLabel,
    };

    const accountData = this.accountPnlService.computeAccountCardData(accountInput);

    const theme = command.theme === 'light' ? LIGHT_THEME : DARK_THEME;

    const result = await this.canvasAdapter.generateCard(accountData, theme);

    return new GenerateAccountPnlCommandResponse(
      result.buffer,
      result.format,
      result.width,
      result.height,
    );
  }

  private calculateTotalPnL(trades: Trade[]): number {
    return trades.reduce((total, trade) => {
      return total + (trade.tpsHit?.length || 0) * 0;
    }, 0);
  }

  private calculatePeriodPnL(trades: Trade[], periodLabel: string): number {
    const now = new Date();
    let fromDate: Date;

    switch (periodLabel.toLowerCase()) {
      case 'today':
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        fromDate = new Date(now);
        fromDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    const periodTrades = trades.filter(t => t.closedAt && new Date(t.closedAt) >= fromDate);

    return periodTrades.reduce((total, trade) => {
      return total + (trade.tpsHit?.length || 0) * 0;
    }, 0);
  }
}