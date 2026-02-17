const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function apiFetch(url, token) {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (res.status === 401) throw new Error('AUTH_REQUIRED');
  if (res.status === 429) throw new Error('RATE_LIMITED');
  if (res.status === 404) throw new Error('NOT_FOUND');
  if (res.status === 503) throw new Error('SERVICE_UNAVAILABLE');
  if (!res.ok) throw new Error(`API error: ${res.status}`);

  return res.json();
}

export async function scanToken(address, token) {
  return apiFetch(`${API_BASE}/deployer/${address}`, token);
}

export async function scanWallet(address, token) {
  return apiFetch(`${API_BASE}/wallet/${address}`, token);
}

export async function checkHealth() {
  return apiFetch(`${API_BASE}/health`);
}
