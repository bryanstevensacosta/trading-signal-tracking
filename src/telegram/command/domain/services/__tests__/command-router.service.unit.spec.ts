import { CommandRouterService, ParsedCommand } from '../command-router.service';

describe('CommandRouterService', () => {
  let service: CommandRouterService;

  beforeEach(() => {
    service = new CommandRouterService();
  });

  describe('parse', () => {
    it('should parse valid command with arguments', () => {
      const result = service.parse('/trades active');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('trades');
      expect(result!.args).toEqual(['active']);
    });

    it('should parse command without arguments', () => {
      const result = service.parse('/start');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('start');
      expect(result!.args).toEqual([]);
    });

    it('should lowercase command name', () => {
      const result = service.parse('/TRADES');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('trades');
    });

    it('should handle multiple arguments', () => {
      const result = service.parse('/entry 123 50000');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('entry');
      expect(result!.args).toEqual(['123', '50000']);
    });

    it('should return null for non-command text', () => {
      const result = service.parse('just some text');

      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = service.parse('');

      expect(result).toBeNull();
    });

    it('should trim whitespace', () => {
      const result = service.parse('  /help  ');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('help');
    });
  });

  describe('route', () => {
    it('should route query commands as query type', () => {
      const result = service.route({ name: 'start', args: [] });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('query');
      expect(result!.name).toBe('start');
    });

    it('should route trades to query', () => {
      const result = service.route({ name: 'trades', args: [] });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('query');
    });

    it('should route active to query', () => {
      const result = service.route({ name: 'active', args: [] });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('query');
    });

    it('should route help to query', () => {
      const result = service.route({ name: 'help', args: [] });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('query');
    });

    it('should route stats to query', () => {
      const result = service.route({ name: 'stats', args: [] });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('query');
    });

    it('should route history to query', () => {
      const result = service.route({ name: 'history', args: [] });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('query');
    });

    it('should route mutation commands as mutation type', () => {
      const result = service.route({ name: 'cancel', args: ['123'] });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('mutation');
      expect(result!.name).toBe('cancel');
    });

    it('should route entry to mutation', () => {
      const result = service.route({ name: 'entry', args: ['123', '50000'] });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('mutation');
    });

    it('should route sl to mutation', () => {
      const result = service.route({ name: 'sl', args: ['123', '49000'] });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('mutation');
    });

    it('should route tp to mutation', () => {
      const result = service.route({ name: 'tp', args: ['123', '1', '52000'] });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('mutation');
    });

    it('should route close to mutation', () => {
      const result = service.route({ name: 'close', args: ['123'] });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('mutation');
    });

    it('should route be to mutation', () => {
      const result = service.route({ name: 'be', args: ['123'] });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('mutation');
    });

    it('should route open to mutation', () => {
      const result = service.route({ name: 'open', args: ['123'] });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('mutation');
    });

    it('should route delete to mutation', () => {
      const result = service.route({ name: 'delete', args: ['123'] });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('mutation');
    });

    it('should return null for unknown commands', () => {
      const result = service.route({ name: 'unknown', args: [] });

      expect(result).toBeNull();
    });

    it('should preserve args when routing', () => {
      const result = service.route({ name: 'entry', args: ['123', '50000'] });

      expect(result).not.toBeNull();
      expect(result!.args).toEqual(['123', '50000']);
    });
  });
});