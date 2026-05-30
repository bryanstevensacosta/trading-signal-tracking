import { EditStateManager, EditState, PendingTrade } from '../edit-state-manager.service';

describe('EditStateManager', () => {
  let manager: EditStateManager;

  beforeEach(() => {
    manager = new EditStateManager();
  });

  describe('startEditing', () => {
    it('should create editing state with all fields', () => {
      manager.startEditing(12345, 'trade-1', 100, 'entry', 200);

      const state = manager.getEditingState(12345, 'trade-1');
      expect(state).toBeDefined();
      expect(state!.tradeId).toBe('trade-1');
      expect(state!.chatId).toBe(12345);
      expect(state!.messageId).toBe(100);
      expect(state!.field).toBe('entry');
      expect(state!.phase).toBe('waiting_for_value');
      expect(state!.confirmationMessageId).toBe(200);
    });

    it('should allow editing multiple trades', () => {
      manager.startEditing(12345, 'trade-1', 100, 'entry', 200);
      manager.startEditing(12345, 'trade-2', 101, 'sl', 201);

      const state1 = manager.getEditingState(12345, 'trade-1');
      const state2 = manager.getEditingState(12345, 'trade-2');

      expect(state1!.field).toBe('entry');
      expect(state2!.field).toBe('sl');
    });

    it('should overwrite existing state for same chat+trade', () => {
      manager.startEditing(12345, 'trade-1', 100, 'entry', 200);
      manager.startEditing(12345, 'trade-1', 101, 'sl', 201);

      const state = manager.getEditingState(12345, 'trade-1');
      expect(state!.messageId).toBe(101);
      expect(state!.field).toBe('sl');
    });
  });

  describe('isWaitingForValue', () => {
    it('should return true when state exists and is waiting', () => {
      manager.startEditing(12345, 'trade-1', 100, 'entry', 200);

      expect(manager.isWaitingForValue(12345, 'trade-1')).toBe(true);
    });

    it('should return false when state does not exist', () => {
      expect(manager.isWaitingForValue(12345, 'trade-1')).toBe(false);
    });
  });

  describe('clearEditingState', () => {
    it('should remove editing state', () => {
      manager.startEditing(12345, 'trade-1', 100, 'entry', 200);
      manager.clearEditingState(12345, 'trade-1');

      expect(manager.getEditingState(12345, 'trade-1')).toBeUndefined();
    });

    it('should not affect other editing states', () => {
      manager.startEditing(12345, 'trade-1', 100, 'entry', 200);
      manager.startEditing(12345, 'trade-2', 101, 'sl', 201);
      manager.clearEditingState(12345, 'trade-1');

      expect(manager.getEditingState(12345, 'trade-1')).toBeUndefined();
      expect(manager.getEditingState(12345, 'trade-2')).toBeDefined();
    });
  });

  describe('getAllEditingStates', () => {
    it('should return empty array when no states', () => {
      expect(manager.getAllEditingStates()).toEqual([]);
    });

    it('should return all editing states', () => {
      manager.startEditing(12345, 'trade-1', 100, 'entry', 200);
      manager.startEditing(67890, 'trade-2', 101, 'sl', 201);

      const states = manager.getAllEditingStates();
      expect(states).toHaveLength(2);
    });
  });

  describe('addPendingTrade', () => {
    it('should add pending trade with all fields', () => {
      manager.addPendingTrade(12345, 'trade-1', 100, 200);

      const pending = manager.getPendingTrade(12345, 'trade-1');
      expect(pending).toBeDefined();
      expect(pending!.tradeId).toBe('trade-1');
      expect(pending!.chatId).toBe(12345);
      expect(pending!.messageId).toBe(100);
      expect(pending!.confirmationMessageId).toBe(200);
    });
  });

  describe('getPendingTrade', () => {
    it('should return pending trade', () => {
      manager.addPendingTrade(12345, 'trade-1', 100, 200);

      const pending = manager.getPendingTrade(12345, 'trade-1');
      expect(pending).toBeDefined();
      expect(pending!.confirmationMessageId).toBe(200);
    });

    it('should return undefined when not found', () => {
      const pending = manager.getPendingTrade(12345, 'trade-1');
      expect(pending).toBeUndefined();
    });
  });

  describe('removePendingTrade', () => {
    it('should remove pending trade', () => {
      manager.addPendingTrade(12345, 'trade-1', 100, 200);
      manager.removePendingTrade(12345, 'trade-1');

      expect(manager.getPendingTrade(12345, 'trade-1')).toBeUndefined();
    });

    it('should not affect other pending trades', () => {
      manager.addPendingTrade(12345, 'trade-1', 100, 200);
      manager.addPendingTrade(67890, 'trade-2', 101, 201);
      manager.removePendingTrade(12345, 'trade-1');

      expect(manager.getPendingTrade(12345, 'trade-1')).toBeUndefined();
      expect(manager.getPendingTrade(67890, 'trade-2')).toBeDefined();
    });
  });
});