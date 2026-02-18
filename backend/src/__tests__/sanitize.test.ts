import { describe, it, expect } from 'vitest';
import { sanitizeString } from '../utils/sanitize';

describe('sanitizeString', () => {
  describe('HTML tag stripping', () => {
    it('strips basic HTML tags', () => {
      expect(sanitizeString('<b>bold</b>')).toBe('bold');
    });

    it('strips script tags with content', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('alert("xss")');
    });

    it('strips img tags with event handlers', () => {
      expect(sanitizeString('<img onerror="alert(1)">')).toBe('');
    });

    it('strips nested tags', () => {
      expect(sanitizeString('<div><span>hello</span></div>')).toBe('hello');
    });

    it('strips self-closing tags', () => {
      expect(sanitizeString('a<br/>b')).toBe('ab');
    });

    it('strips on-chain gotcha: <MOON> is removed entirely', () => {
      // The regex /<[^>]*>/g treats <MOON> as an HTML tag
      expect(sanitizeString('<MOON>')).toBe('');
      expect(sanitizeString('TO THE <MOON> TOKEN')).toBe('TO THE  TOKEN');
    });
  });

  describe('control character removal', () => {
    it('strips null bytes', () => {
      expect(sanitizeString('hello\x00world')).toBe('helloworld');
    });

    it('strips carriage returns', () => {
      expect(sanitizeString('hello\rworld')).toBe('helloworld');
    });

    it('strips DEL character', () => {
      expect(sanitizeString('hello\x7Fworld')).toBe('helloworld');
    });

    it('strips tabs and newlines', () => {
      expect(sanitizeString('a\tb\nc')).toBe('abc');
    });
  });

  describe('trimming and length cap', () => {
    it('trims leading and trailing whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
    });

    it('caps output at 100 characters', () => {
      const long = 'a'.repeat(200);
      expect(sanitizeString(long)).toBe('a'.repeat(100));
    });

    it('strips tags first, then truncates', () => {
      // 50 chars of tags + 120 chars of text → after strip: 120 chars → truncated to 100
      const input = '<b>' + 'x'.repeat(120) + '</b>';
      const result = sanitizeString(input);
      expect(result.length).toBe(100);
      expect(result).toBe('x'.repeat(100));
    });
  });

  describe('non-string inputs', () => {
    it('returns empty string for null', () => {
      expect(sanitizeString(null as any)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(sanitizeString(undefined as any)).toBe('');
    });

    it('returns empty string for number', () => {
      expect(sanitizeString(42 as any)).toBe('');
    });

    it('returns empty string for object', () => {
      expect(sanitizeString({} as any)).toBe('');
    });
  });
});
