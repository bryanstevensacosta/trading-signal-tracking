import fc from 'fast-check';
import { CommandRouterService } from '../command-router.service';

describe('CommandRouterService (property-based)', () => {
  let service: CommandRouterService;

  beforeEach(() => {
    service = new CommandRouterService();
  });

  describe('parse', () => {
    it('should return null for text not starting with /', () => {
      fc.assert(
        fc.property(
          fc.string().filter(text => !text.startsWith('/')),
          (text) => {
            const result = service.parse(text);
            return result === null;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should lowercase command names', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 10 }),
          (cmdName) => {
            const text = '/' + cmdName.toUpperCase();
            const result = service.parse(text);

            if (result === null) return true;
            return result.name === result.name.toLowerCase();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('route', () => {
    const queryCommands = ['start', 'help', 'trades', 'active', 'history', 'stats', 'trade', 'price'];
    const mutationCommands = ['cancel', 'delete', 'entry', 'sl', 'tp', 'close', 'open', 'be'];

    it('should route mutation commands to mutation type', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...mutationCommands),
          (cmdName) => {
            const result = service.route({ name: cmdName, args: [] });
            return result !== null && result.type === 'mutation';
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should route query commands to query type', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...queryCommands),
          (cmdName) => {
            const result = service.route({ name: cmdName, args: [] });
            return result !== null && result.type === 'query';
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});