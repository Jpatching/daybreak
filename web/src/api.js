const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

/**
 * Payment-required error with x402 details attached.
 */
export class PaymentRequiredError extends Error {
  constructor(data) {
    super('PAYMENT_REQUIRED');
    this.name = 'PaymentRequiredError';
    this.priceUsd = data.price_usd;
    this.details = data.details;
    this.paidEndpoint = data.paid_endpoint;
  }
}

async function apiFetch(url, token) {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (res.status === 401) throw new Error('AUTH_REQUIRED');
  if (res.status === 402) {
    const data = await res.json();
    throw new PaymentRequiredError(data);
  }
  if (res.status === 429) throw new Error('RATE_LIMITED');
  if (res.status === 404) throw new Error('NOT_FOUND');
  if (res.status === 503) throw new Error('SERVICE_UNAVAILABLE');
  if (!res.ok) throw new Error(`API error: ${res.status}`);

  return res.json();
}

/**
 * Scan via the paid x402 endpoint with an X-PAYMENT header.
 */
async function paidFetch(url, paymentHeader) {
  const res = await fetch(url, {
    headers: { 'X-PAYMENT': paymentHeader },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Payment scan failed (${res.status})`);
  }

  return res.json();
}

export async function scanToken(address, token) {
  return apiFetch(`${API_BASE}/deployer/${address}`, token);
}

export async function scanTokenPaid(address, paymentHeader) {
  return paidFetch(`${API_BASE}/paid/deployer/${address}`, paymentHeader);
}

export async function scanWallet(address, token) {
  return apiFetch(`${API_BASE}/wallet/${address}`, token);
}

export async function scanWalletPaid(address, paymentHeader) {
  return paidFetch(`${API_BASE}/paid/wallet/${address}`, paymentHeader);
}

export async function checkHealth() {
  return apiFetch(`${API_BASE}/health`);
}

export async function fetchUsage(token) {
  return apiFetch(`${API_BASE}/auth/usage`, token);
}
