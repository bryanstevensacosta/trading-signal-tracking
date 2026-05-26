import { MessageSourceVO } from '../message-source.vo';

describe('MessageSourceVO', () => {
  describe('fromTelegram', () => {
    it('should create MessageSourceVO from message', () => {
      const update = {
        message: {
          chat: { id: 123456789 },
          message_id: 42,
          from: { username: 'testuser', first_name: 'Test' },
          date: 1700000000,
        },
      };

      const result = MessageSourceVO.fromTelegram(update);

      expect(result.chatId).toBe(123456789);
      expect(result.messageId).toBe(42);
      expect(result.username).toBe('testuser');
      expect(result.firstName).toBe('Test');
      expect(result.timestamp).toEqual(new Date(1700000000 * 1000));
    });

    it('should handle missing user data', () => {
      const update = {
        message: {
          chat: { id: 123456789 },
          message_id: 42,
          from: undefined,
          date: 1700000000,
        },
      };

      const result = MessageSourceVO.fromTelegram(update);

      expect(result.chatId).toBe(123456789);
      expect(result.messageId).toBe(42);
      expect(result.username).toBeUndefined();
      expect(result.firstName).toBeUndefined();
    });

    it('should create MessageSourceVO from edited_message', () => {
      const update = {
        edited_message: {
          chat: { id: 987654321 },
          message_id: 99,
          from: { username: 'editor' },
          date: 1700000000,
        },
      };

      const result = MessageSourceVO.fromTelegram(update);

      expect(result.chatId).toBe(987654321);
      expect(result.messageId).toBe(99);
      expect(result.username).toBe('editor');
    });

    it('should throw when no message or edited_message', () => {
      const update = {};

      expect(() => MessageSourceVO.fromTelegram(update)).toThrow(
        'No message or edited_message in update',
      );
    });
  });

  describe('constructor', () => {
    it('should set default timestamp to now', () => {
      const before = new Date();
      const source = new MessageSourceVO(123456789, 42);
      const after = new Date();

      expect(source.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(source.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should accept custom timestamp', () => {
      const customDate = new Date('2024-01-01');
      const source = new MessageSourceVO(123456789, 42, undefined, undefined, customDate);

      expect(source.timestamp).toEqual(customDate);
    });
  });
});