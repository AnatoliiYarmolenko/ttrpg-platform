import { describe, expect, it } from 'vitest';
import { normalizeEventCode } from '@/features/notifications/hooks/useNotificationSSE';

describe('normalizeEventCode', () => {
  it('prioritizes type over eventKey', () => {
    const code = normalizeEventCode({
      type: 'session_confirmed',
      eventKey: 'session_join_requests:123',
    });

    expect(code).toBe('SESSION_CONFIRMED');
  });

  it('falls back to eventType when type is missing', () => {
    const code = normalizeEventCode({
      eventType: 'campaign_join_requests',
      eventKey: 'campaign_join_requests:99',
    });

    expect(code).toBe('CAMPAIGN_JOIN_REQUESTS');
  });

  it('parses eventKey prefix and uppercases', () => {
    const code = normalizeEventCode({ eventKey: 'session_join_requests:42' });

    expect(code).toBe('SESSION_JOIN_REQUESTS');
  });

  it('returns empty string for invalid input', () => {
    expect(normalizeEventCode(null)).toBe('');
    expect(normalizeEventCode({ eventKey: 123 })).toBe('');
  });
});
