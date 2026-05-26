import { IngestMessageCommand } from '../command';
import { MessageSourceVO } from '../../../../domain/value-objects/message-source.vo';

describe('IngestMessageCommand', () => {
  it('should create command with text and source', () => {
    const text = 'LONG BTCUSDT Entry: 50000 SL: 49000';
    const source = new MessageSourceVO(123456789, 42);

    const command = new IngestMessageCommand(text, source);

    expect(command.text).toBe(text);
    expect(command.source).toBe(source);
  });

  it('should preserve text with special characters', () => {
    const text = 'LONG BTCUSDT Entry: 50,000.50 SL: 49,000 #signal 📈';
    const source = new MessageSourceVO(123456789, 42);

    const command = new IngestMessageCommand(text, source);

    expect(command.text).toBe(text);
  });

  it('should accept empty message', () => {
    const source = new MessageSourceVO(123456789, 42);
    const command = new IngestMessageCommand('', source);

    expect(command.text).toBe('');
    expect(command.source).toBe(source);
  });

  it('should handle different source values', () => {
    const sources = [
      new MessageSourceVO(123456789, 1),
      new MessageSourceVO(987654321, 999),
      new MessageSourceVO(111222333, 42, 'username'),
      new MessageSourceVO(444555666, 7, 'user', 'Name'),
    ];

    for (const source of sources) {
      const command = new IngestMessageCommand('test', source);
      expect(command.source).toBe(source);
    }
  });
});