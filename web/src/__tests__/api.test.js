import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanToken, scanWallet, scanTokenPaid, scanWalletPaid, fetchUsage, checkHealth, PaymentRequiredError } from '../api.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('API module', () => {
  describe('checkHealth', () => {
    it('returns health data on 200', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'ok', helius: true, version: '1.0.0' }),
      });

      const result = await checkHealth();
      expect(result.status).toBe('ok');
      expect(result.helius).toBe(true);
    });
  });

  describe('scanToken', () => {
    it('passes Bearer token in Authorization header', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ token: {}, deployer: {} }),
      });

      await scanToken('someAddress', 'my-jwt-token');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/deployer/someAddress'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer my-jwt-token' },
        })
      );
    });

    it('throws AUTH_REQUIRED on 401', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401 });

      await expect(scanToken('addr', 'token')).rejects.toThrow('AUTH_REQUIRED');
    });

    it('throws PaymentRequiredError on 402', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 402,
        json: () => Promise.resolve({
          payment_required: true,
          price_usd: 0.01,
          paid_endpoint: '/api/v1/paid/deployer/addr',
          details: {},
        }),
      });

      await expect(scanToken('addr', 'token')).rejects.toThrow(PaymentRequiredError);
    });

    it('throws RATE_LIMITED on 429', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 429 });
      await expect(scanToken('addr', 'token')).rejects.toThrow('RATE_LIMITED');
    });

    it('throws NOT_FOUND on 404', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });
      await expect(scanToken('addr', 'token')).rejects.toThrow('NOT_FOUND');
    });

    it('throws SERVICE_UNAVAILABLE on 503', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 503 });
      await expect(scanToken('addr', 'token')).rejects.toThrow('SERVICE_UNAVAILABLE');
    });
  });

  describe('scanWallet', () => {
    it('calls wallet endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ deployer: {} }),
      });

      await scanWallet('walletAddr', 'jwt');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/wallet/walletAddr'),
        expect.any(Object)
      );
    });
  });
});

describe('scanTokenPaid', () => {
  it('calls /paid/deployer/:addr with X-PAYMENT header (not Authorization)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: {}, deployer: {} }),
    });

    await scanTokenPaid('someAddr', 'base64-payment-data');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/paid/deployer/someAddr'),
      expect.objectContaining({
        headers: { 'X-PAYMENT': 'base64-payment-data' },
      })
    );
  });

  it('returns JSON on 200', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ verdict: 'CLEAN', score: 95 }),
    });

    const result = await scanTokenPaid('addr', 'payment');
    expect(result.verdict).toBe('CLEAN');
  });

  it('throws with data.error on failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Invalid payment signature' }),
    });

    await expect(scanTokenPaid('addr', 'bad')).rejects.toThrow('Invalid payment signature');
  });

  it('throws with fallback message when json() fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
    });

    await expect(scanTokenPaid('addr', 'pay')).rejects.toThrow('Payment scan failed (500)');
  });
});

describe('scanWalletPaid', () => {
  it('calls /paid/wallet/:addr with X-PAYMENT header', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ deployer: {} }),
    });

    await scanWalletPaid('walletAddr', 'payment-header');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/paid/wallet/walletAddr'),
      expect.objectContaining({
        headers: { 'X-PAYMENT': 'payment-header' },
      })
    );
  });

  it('returns parsed JSON on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ deployer: { wallet: 'abc' } }),
    });

    const result = await scanWalletPaid('addr', 'pay');
    expect(result.deployer.wallet).toBe('abc');
  });
});

describe('fetchUsage', () => {
  it('calls /auth/usage with Bearer token', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ scans_used: 1, scans_limit: 3 }),
    });

    const result = await fetchUsage('my-jwt');
    expect(result.scans_used).toBe(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/usage'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer my-jwt' },
      })
    );
  });

  it('throws AUTH_REQUIRED on 401', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });
    await expect(fetchUsage('expired-token')).rejects.toThrow('AUTH_REQUIRED');
  });

  it('throws RATE_LIMITED on 429', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429 });
    await expect(fetchUsage('token')).rejects.toThrow('RATE_LIMITED');
  });
});

describe('PaymentRequiredError', () => {
  it('captures price and details', () => {
    const err = new PaymentRequiredError({
      price_usd: 0.01,
      details: { payTo: 'wallet123' },
      paid_endpoint: '/api/v1/paid/deployer/addr',
    });

    expect(err.name).toBe('PaymentRequiredError');
    expect(err.priceUsd).toBe(0.01);
    expect(err.paidEndpoint).toBe('/api/v1/paid/deployer/addr');
    expect(err.message).toBe('PAYMENT_REQUIRED');
  });
});
