import { ParseTradeCommand } from '../command';

describe('ParseTradeCommand', () => {
  it('should create command with message', () => {
    const command = new ParseTradeCommand('LONG BTCUSDT Entry: 50000');

    expect(command.message).toBe('LONG BTCUSDT Entry: 50000');
  });

  it('should accept empty message', () => {
    const command = new ParseTradeCommand('');

    expect(command.message).toBe('');
  });

  it('should preserve message with special characters', () => {
    const message = 'LONG BTCUSDT Entry: 50,000 SL: 49,000 https://example.com/chart.png';
    const command = new ParseTradeCommand(message);

    expect(command.message).toBe(message);
  });
});