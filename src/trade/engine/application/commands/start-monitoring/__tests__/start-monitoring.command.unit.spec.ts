import { StartMonitoringCommand } from '../command';

describe('StartMonitoringCommand', () => {
  describe('constructor', () => {
    it('should create command with tradeId', () => {
      const tradeId = 'test-trade-id';
      const command = new StartMonitoringCommand(tradeId);

      expect(command.tradeId).toBe(tradeId);
    });

    it('should store tradeId correctly', () => {
      const tradeId = 'another-trade-id';
      const command = new StartMonitoringCommand(tradeId);

      expect(command.tradeId).toBe(tradeId);
    });
  });
});