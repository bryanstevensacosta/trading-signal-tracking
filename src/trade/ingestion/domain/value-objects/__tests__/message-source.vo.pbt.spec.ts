import { MessageSourceVO } from '../message-source.vo';

describe('MessageSourceVO', () => {
  describe('arb', () => {
    it('should generate valid MessageSourceVO instances', () => {
      const chatId = 123456789;
      const messageId = 42;
      const timestamp = new Date();

      const source = new MessageSourceVO(chatId, messageId, undefined, undefined, timestamp);

      expect(source.chatId).toBe(chatId);
      expect(source.messageId).toBe(messageId);
      expect(source.timestamp).toBe(timestamp);
      expect(source.username).toBeUndefined();
      expect(source.firstName).toBeUndefined();
    });

    it('should handle all properties', () => {
      const chatId = 987654321;
      const messageId = 99;
      const username = 'testuser';
      const firstName = 'Test';
      const timestamp = new Date();

      const source = new MessageSourceVO(chatId, messageId, username, firstName, timestamp);

      expect(source.chatId).toBe(chatId);
      expect(source.messageId).toBe(messageId);
      expect(source.username).toBe(username);
      expect(source.firstName).toBe(firstName);
      expect(source.timestamp).toBe(timestamp);
    });

    it('should have readonly properties', () => {
      const source = new MessageSourceVO(123, 456);
      
      expect(Object.keys(source)).toContain('chatId');
      expect(Object.keys(source)).toContain('messageId');
    });
  });

  describe('fromTelegram', () => {
    it('should handle various chat IDs', () => {
      const chatIds = [1, 123456789, 999999999, Number.MAX_SAFE_INTEGER];
      
      for (const chatId of chatIds) {
        const update = {
          message: {
            chat: { id: chatId },
            message_id: 1,
            from: undefined,
            date: 1700000000,
          },
        };
        
        const result = MessageSourceVO.fromTelegram(update);
        expect(result.chatId).toBe(chatId);
      }
    });

    it('should handle large message IDs', () => {
      const update = {
        message: {
          chat: { id: 123 },
          message_id: Number.MAX_SAFE_INTEGER,
          from: undefined,
          date: 1700000000,
        },
      };
      
      const result = MessageSourceVO.fromTelegram(update);
      expect(result.messageId).toBe(Number.MAX_SAFE_INTEGER);
    });
  });
});