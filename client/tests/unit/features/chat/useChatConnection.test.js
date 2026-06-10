import { describe, expect, it, vi, afterEach } from 'vitest';
import { 
  upsertMessageIntoList, 
  isFatalChatErrorCode, 
  normalizeAuthor, 
  mergeMessages 
} from '@/features/chat/hooks/useChatConnection';

describe('useChatConnection utilities', () => {
  
  describe('upsertMessageIntoList', () => {
    it('should merge REST message with local pending record using heuristics', () => {
      const currentState = [{
        id: 'tmp-123',
        clientMessageId: 'tmp-123',
        content: 'го',
        authorId: 7,
        pending: true,
        createdAt: '2026-05-15T10:00:00.000Z'
      }];

      const restMessage = {
        id: 999,
        content: 'го',
        authorId: 7,
        createdAt: '2026-05-15T10:00:02.000Z'
      };

      const result = upsertMessageIntoList(currentState, restMessage);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(999);
      expect(result[0].pending).toBe(false);
      expect(result[0].status).toBe('sent');
    });

    it('should not merge if time difference is greater than 15 seconds', () => {
      const currentState = [{
        id: 'tmp-123',
        clientMessageId: 'tmp-123',
        content: 'го',
        authorId: 7,
        pending: true,
        createdAt: '2026-05-15T10:00:00.000Z'
      }];

      const restMessage = {
        id: 999,
        content: 'го',
        authorId: 7,
        createdAt: '2026-05-15T10:00:20.000Z'
      };

      const result = upsertMessageIntoList(currentState, restMessage);
      expect(result).toHaveLength(2);
    });
  });

  describe('isFatalChatErrorCode', () => {
    it('returns true for critical errors', () => {
      expect(isFatalChatErrorCode('AUTH_INVALID_TOKEN')).toBe(true);
      expect(isFatalChatErrorCode('SECURITY_BREACH')).toBe(true);
      expect(isFatalChatErrorCode('ADMIN_BAN')).toBe(true);
      expect(isFatalChatErrorCode('CHAT_NOT_FOUND')).toBe(true);
    });

    it('returns false for non-critical errors', () => {
      expect(isFatalChatErrorCode('RATE_LIMIT')).toBe(false);
      expect(isFatalChatErrorCode('VALIDATION_ERROR')).toBe(false);
      expect(isFatalChatErrorCode('MESSAGE_TOO_LONG')).toBe(false);
      expect(isFatalChatErrorCode(null)).toBe(false);
      expect(isFatalChatErrorCode(123)).toBe(false);
    });
  });

  describe('normalizeAuthor', () => {
    it('correctly maps full user object', () => {
      const user = {
        id: 1,
        username: 'testuser',
        displayName: 'Test User',
        avatarUrl: 'http://image.com/avatar.png'
      };
      const result = normalizeAuthor(user);
      expect(result).toEqual({
        id: 1,
        username: 'testuser',
        displayName: 'Test User',
        avatarUrl: 'http://image.com/avatar.png'
      });
    });

    it('uses username as fallback for displayName', () => {
      const user = { id: 2, username: 'onlyuser' };
      const result = normalizeAuthor(user);
      expect(result.displayName).toBe('onlyuser');
      expect(result.avatarUrl).toBeNull();
    });

    it('handles null and empty objects', () => {
      expect(normalizeAuthor(null)).toBeNull();
      expect(normalizeAuthor(undefined)).toBeNull();
      const empty = normalizeAuthor({});
      expect(empty.id).toBeUndefined();
      expect(empty.username).toBeNull();
    });
  });

  describe('mergeMessages', () => {
    it('merges arrays without duplicates by ID', () => {
      const current = [
        { id: 1, content: 'One' },
        { id: 2, content: 'Two' }
      ];
      const incoming = [
        { id: 2, content: 'Two updated' },
        { id: 3, content: 'Three' }
      ];
      const result = mergeMessages(current, incoming);
      expect(result).toHaveLength(3);
      expect(result.find(m => m.id === 2).content).toBe('Two updated');
      expect(result.find(m => m.id === 3)).toBeDefined();
    });

    it('correctly handles empty input data', () => {
      const current = [{ id: 1 }];
      expect(mergeMessages(current, null)).toEqual(current);
      expect(mergeMessages(current, [])).toEqual(current);
      expect(mergeMessages(null, [{ id: 1 }])).toHaveLength(1);
    });

    it('integrates with pending message merging logic', () => {
      const current = [{
        id: 'tmp-1',
        clientMessageId: 'tmp-1',
        content: 'Pending',
        authorId: 5,
        pending: true,
        createdAt: '2026-05-15T10:00:00.000Z'
      }];
      const incoming = [{
        id: 100,
        content: 'Pending',
        authorId: 5,
        createdAt: '2026-05-15T10:00:05.000Z'
      }];
      
      const result = mergeMessages(current, incoming);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(100);
      expect(result[0].pending).toBe(false);
    });
  });
});
