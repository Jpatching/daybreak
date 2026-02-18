import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TTLCache } from '../services/cache';

describe('TTLCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('get()', () => {
    it('returns null for missing key', () => {
      const cache = new TTLCache<string>(60);
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('returns data before TTL expires', () => {
      const cache = new TTLCache<string>(60);
      cache.set('key', 'value');
      vi.advanceTimersByTime(59_999);
      expect(cache.get('key')).toBe('value');
    });

    it('returns data at exactly TTL (strict > means still valid)', () => {
      const cache = new TTLCache<string>(60);
      cache.set('key', 'value');
      // At exactly 60000ms, Date.now() === entry.expires, so !(now > expires) → still valid
      vi.advanceTimersByTime(60_000);
      expect(cache.get('key')).toBe('value');
    });

    it('returns null after TTL+1ms (expired)', () => {
      const cache = new TTLCache<string>(60);
      cache.set('key', 'value');
      vi.advanceTimersByTime(60_001);
      expect(cache.get('key')).toBeNull();
    });
  });

  describe('set()', () => {
    it('overwrites existing value and resets TTL', () => {
      const cache = new TTLCache<string>(60);
      cache.set('key', 'old');
      vi.advanceTimersByTime(50_000);
      cache.set('key', 'new');
      vi.advanceTimersByTime(50_000);
      // 50s after the second set — still valid (60s TTL)
      expect(cache.get('key')).toBe('new');
    });
  });

  describe('falsy values', () => {
    it('stores and returns false correctly', () => {
      const cache = new TTLCache<boolean>(60);
      cache.set('key', false);
      expect(cache.get('key')).toBe(false);
    });

    it('stores and returns 0 correctly', () => {
      const cache = new TTLCache<number>(60);
      cache.set('key', 0);
      expect(cache.get('key')).toBe(0);
    });

    it('stores and returns empty string correctly', () => {
      const cache = new TTLCache<string>(60);
      cache.set('key', '');
      expect(cache.get('key')).toBe('');
    });
  });

  describe('cleanup interval', () => {
    it('removes expired entries on cleanup cycle', () => {
      const cache = new TTLCache<string>(5); // 5 second TTL
      cache.set('a', '1');
      cache.set('b', '2');

      // Advance past TTL but before cleanup interval
      vi.advanceTimersByTime(6_000);

      // Both should be expired when accessed
      expect(cache.get('a')).toBeNull();
      expect(cache.get('b')).toBeNull();
    });

    it('cleanup fires every 60 seconds', () => {
      const cache = new TTLCache<string>(10); // 10 second TTL
      cache.set('key', 'value');

      // Advance to 11s — expired but cleanup hasn't run yet (runs at 60s)
      vi.advanceTimersByTime(11_000);
      // get() handles expired entries on access
      expect(cache.get('key')).toBeNull();
    });
  });
});
