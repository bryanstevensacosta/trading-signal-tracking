import { StopMonitoringCommand } from '../command';

describe('StopMonitoringCommand', () => {
  describe('constructor', () => {
    it('should create command with tradeId', () => {
      const tradeId = 'test-trade-id';
      const command = new StopMonitoringCommand(tradeId);

      expect(command.tradeId).toBe(tradeId);
      expect(command.reason).toBeUndefined();
    });

    it('should create command with tradeId and reason', () => {
      const tradeId = 'test-trade-id';
      const reason = 'manually_stopped';
      const command = new StopMonitoringCommand(tradeId, reason);

      expect(command.tradeId).toBe(tradeId);
      expect(command.reason).toBe(reason);
    });

    it('should allow empty reason', () => {
      const tradeId = 'test-trade-id';
      const command = new StopMonitoringCommand(tradeId, '');

      expect(command.tradeId).toBe(tradeId);
      expect(command.reason).toBe('');
    });
  });
});