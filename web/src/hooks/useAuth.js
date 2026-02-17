import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export default function useAuth() {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const [token, setToken] = useState(() => sessionStorage.getItem('daybreak_token'));
  const [isAuthenticated, setIsAuthenticated] = useState(!!token);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Clear auth when wallet disconnects
  useEffect(() => {
    if (!connected) {
      setToken(null);
      setIsAuthenticated(false);
      sessionStorage.removeItem('daybreak_token');
    }
  }, [connected]);

  const login = useCallback(async () => {
    if (!publicKey || !signMessage) return;

    setLoading(true);
    setError(null);

    try {
      const wallet = publicKey.toBase58();

      // Step 1: Get nonce
      const nonceRes = await fetch(`${API_BASE}/auth/nonce?wallet=${wallet}`);
      if (!nonceRes.ok) throw new Error('Failed to get nonce');
      const { nonce } = await nonceRes.json();

      // Step 2: Sign the nonce
      const messageBytes = new TextEncoder().encode(nonce);
      const signatureBytes = await signMessage(messageBytes);
      const signature = bs58.encode(signatureBytes);

      // Step 3: Verify and get JWT
      const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, signature, message: nonce }),
      });

      if (!verifyRes.ok) throw new Error('Signature verification failed');
      const { token: jwt } = await verifyRes.json();

      setToken(jwt);
      setIsAuthenticated(true);
      sessionStorage.setItem('daybreak_token', jwt);
    } catch (err) {
      setError(err.message);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, [publicKey, signMessage]);

  const logout = useCallback(() => {
    setToken(null);
    setIsAuthenticated(false);
    sessionStorage.removeItem('daybreak_token');
    disconnect();
  }, [disconnect]);

  return {
    isAuthenticated,
    token,
    wallet: publicKey?.toBase58() || null,
    connected,
    login,
    logout,
    loading,
    error,
  };
}
