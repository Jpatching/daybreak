import { describe, it, expect } from 'vitest';
import { isValidSolanaAddress } from '../utils/validate';

describe('isValidSolanaAddress', () => {
  it('accepts valid Solana addresses', () => {
    // Known real addresses
    expect(isValidSolanaAddress('5rSwWRfqGvnQaiJpW3sb3YKLbxtjVxgc4yrvrHNeNwE2')).toBe(true);
    expect(isValidSolanaAddress('61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump')).toBe(true);
    expect(isValidSolanaAddress('So11111111111111111111111111111111111111112')).toBe(true);
  });

  it('rejects empty/null values', () => {
    expect(isValidSolanaAddress('')).toBe(false);
    expect(isValidSolanaAddress(null as any)).toBe(false);
    expect(isValidSolanaAddress(undefined as any)).toBe(false);
  });

  it('rejects addresses that are too short or too long', () => {
    expect(isValidSolanaAddress('abc')).toBe(false);
    expect(isValidSolanaAddress('a'.repeat(50))).toBe(false);
  });

  it('rejects invalid base58 characters', () => {
    // 0, O, I, l are not valid base58
    expect(isValidSolanaAddress('0rSwWRfqGvnQaiJpW3sb3YKLbxtjVxgc4yrvrHNeNwE2')).toBe(false);
    expect(isValidSolanaAddress('OrSwWRfqGvnQaiJpW3sb3YKLbxtjVxgc4yrvrHNeNwE2')).toBe(false);
    expect(isValidSolanaAddress('IrSwWRfqGvnQaiJpW3sb3YKLbxtjVxgc4yrvrHNeNwE2')).toBe(false);
    expect(isValidSolanaAddress('lrSwWRfqGvnQaiJpW3sb3YKLbxtjVxgc4yrvrHNeNwE2')).toBe(false);
  });

  it('rejects non-string types', () => {
    expect(isValidSolanaAddress(12345 as any)).toBe(false);
    expect(isValidSolanaAddress({} as any)).toBe(false);
  });
});
