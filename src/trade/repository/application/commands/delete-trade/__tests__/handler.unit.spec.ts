import { DeleteTradeHandler } from '../handler';
import { DeleteTradeCommand } from '../command';
import { SqliteTradeAdapter } from '@trade/repository/infrastructure/adapters/sqlite-trade.adapter';

describe('DeleteTradeHandler', () => {
  let mockRepository: jest.Mocked<SqliteTradeAdapter>;

  beforeEach(() => {
    mockRepository = {
      repository: {} as any,
      save: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findActive: jest.fn(),
      findPending: jest.fn(),
      findByStatus: jest.fn(),
      findBySymbol: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<SqliteTradeAdapter>;
  });

  describe('execute', () => {
    it('should call repository.delete with command id', async () => {
      mockRepository.delete.mockResolvedValue(true);
      const handler = new DeleteTradeHandler(mockRepository);
      const command = new DeleteTradeCommand('trade-123');

      await handler.execute(command);

      expect(mockRepository.delete).toHaveBeenCalledWith('trade-123');
    });

    it('should return true when trade is deleted', async () => {
      mockRepository.delete.mockResolvedValue(true);
      const handler = new DeleteTradeHandler(mockRepository);
      const command = new DeleteTradeCommand('trade-123');

      const result = await handler.execute(command);

      expect(result).toBe(true);
    });

    it('should return false when trade not found', async () => {
      mockRepository.delete.mockResolvedValue(false);
      const handler = new DeleteTradeHandler(mockRepository);
      const command = new DeleteTradeCommand('non-existent');

      const result = await handler.execute(command);

      expect(result).toBe(false);
    });

    it('should pass through repository errors', async () => {
      const error = new Error('Database error');
      mockRepository.delete.mockRejectedValue(error);
      const handler = new DeleteTradeHandler(mockRepository);
      const command = new DeleteTradeCommand('trade-123');

      await expect(handler.execute(command)).rejects.toThrow('Database error');
    });

    it('should handle empty string id', async () => {
      mockRepository.delete.mockResolvedValue(false);
      const handler = new DeleteTradeHandler(mockRepository);
      const command = new DeleteTradeCommand('');

      await handler.execute(command);

      expect(mockRepository.delete).toHaveBeenCalledWith('');
    });
  });
});