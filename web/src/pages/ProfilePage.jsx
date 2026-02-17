import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import useAuth from '../hooks/useAuth';
import { fetchUsage } from '../api';
import {
  ArrowLeft,
  Wallet,
  Shield,
  Clock,
  Loader2,
  Menu,
  X,
  ExternalLink,
  Zap,
  Key,
} from 'lucide-react';

function DaybreakLogo({ size = 28 }) {
  return (
    <img
      src="/daybreak-logo-square.png"
      alt="Daybreak"
      style={{ width: size, height: size }}
      className="object-contain rounded-lg"
    />
  );
}

const gradientTextStyle = {
  background: 'linear-gradient(180deg, #ffffff 0%, #f59e0b 50%, #d97706 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  filter: 'drop-shadow(0 0 15px rgba(245, 158, 11, 0.4))',
};

function truncAddr(addr) {
  if (!addr) return '...';
  return addr.slice(0, 6) + '...' + addr.slice(-6);
}

export default function ProfilePage() {
  const { connected } = useWallet();
  const { isAuthenticated, token, wallet, login, logout, loading: authLoading, error: authError } = useAuth();
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const refreshUsage = useCallback(async () => {
    if (!token) return;
    setUsageLoading(true);
    try {
      const data = await fetchUsage(token);
      setUsage(data);
    } catch {
      // non-critical
    } finally {
      setUsageLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (connected && !isAuthenticated && !authLoading) {
      login();
    }
  }, [connected, isAuthenticated, authLoading, login]);

  useEffect(() => {
    if (isAuthenticated && token) {
      refreshUsage();
    }
  }, [isAuthenticated, token, refreshUsage]);

  const pct = usage ? (usage.scans_used / usage.scans_limit) * 100 : 0;
  const barColor = usage && usage.scans_remaining <= 0 ? 'bg-red-500' : usage && usage.scans_remaining <= 1 ? 'bg-yellow-500' : 'bg-amber-500';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-black/90 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center">
            <DaybreakLogo size={44} />
          </a>
          <div className="hidden sm:flex items-center gap-4">
            <a href="/" className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-sm">
              <ArrowLeft size={16} />
              Home
            </a>
            <a href="/scan" className="text-slate-400 hover:text-white transition-colors text-sm">
              Scanner
            </a>
            <WalletMultiButton className="!bg-amber-500 !text-slate-900 !font-semibold !rounded-lg !text-sm !h-9 !px-4 hover:!bg-amber-400" />
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden text-slate-300 hover:text-white transition-colors"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="sm:hidden bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
            <div className="px-6 py-4 flex flex-col gap-3">
              <a href="/" className="text-slate-300 hover:text-white transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>Home</a>
              <a href="/scan" className="text-slate-300 hover:text-white transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>Scanner</a>
              <div className="py-2">
                <WalletMultiButton className="!bg-amber-500 !text-slate-900 !font-semibold !rounded-lg !text-sm !h-9 !px-4" />
              </div>
            </div>
          </div>
        )}
      </nav>

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-2" style={gradientTextStyle}>
            Profile & API
          </h1>
          <p className="text-slate-400 text-center mb-10">
            Your wallet, usage limits, and API access.
          </p>

          {/* Not connected */}
          {!connected && (
            <div className="text-center py-16">
              <Wallet className="w-14 h-14 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 mb-4">Connect your wallet to view your profile</p>
              <WalletMultiButton className="!bg-amber-500 !text-slate-900 !font-semibold !rounded-lg !text-base !h-12 !px-8 hover:!bg-amber-400 mx-auto" />
            </div>
          )}

          {/* Auth loading */}
          {connected && !isAuthenticated && authLoading && (
            <div className="text-center py-16">
              <Loader2 className="w-10 h-10 animate-spin text-amber-400 mx-auto mb-4" />
              <p className="text-slate-400">Authenticating wallet...</p>
            </div>
          )}

          {/* Auth error */}
          {authError && (
            <div className="text-center py-8">
              <p className="text-red-400 mb-4">{authError}</p>
              <button onClick={login} className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg">
                Try Again
              </button>
            </div>
          )}

          {/* Authenticated */}
          {isAuthenticated && (
            <div className="space-y-6">

              {/* Wallet card */}
              <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Shield size={14} />
                  Connected Wallet
                </h3>
                <div className="flex items-center justify-between">
                  <div>
                    <a
                      href={`https://solscan.io/account/${wallet}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-lg font-mono text-white hover:text-amber-400 transition-colors inline-flex items-center gap-2"
                    >
                      {truncAddr(wallet)}
                      <ExternalLink size={14} />
                    </a>
                    <p className="text-xs text-slate-500 mt-1">Authenticated via ed25519 signature</p>
                  </div>
                  <button
                    onClick={logout}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/50 rounded-lg transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>

              {/* Usage card */}
              <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Zap size={14} />
                  Free Scan Usage
                </h3>

                {usageLoading && !usage && (
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Loader2 size={14} className="animate-spin" />
                    Loading usage...
                  </div>
                )}

                {usage && (
                  <div>
                    {/* Big numbers */}
                    <div className="grid grid-cols-3 gap-6 mb-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-white">{usage.scans_remaining}</div>
                        <div className="text-xs text-slate-500 mt-1">Scans Remaining</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-slate-400">{usage.scans_used}</div>
                        <div className="text-xs text-slate-500 mt-1">Used Today</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-amber-400">{usage.scans_limit}</div>
                        <div className="text-xs text-slate-500 mt-1">Daily Limit</div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-400">{usage.scans_used} of {usage.scans_limit} free scans used today</span>
                        {usage.scans_remaining <= 0 ? (
                          <span className="text-red-400 font-semibold">Limit reached</span>
                        ) : (
                          <span className="text-slate-500">{usage.scans_remaining} left</span>
                        )}
                      </div>
                      <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>

                    {/* Reset info */}
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock size={12} />
                      <span>Usage resets 24 hours after your first scan of the day</span>
                    </div>

                    {/* Refresh */}
                    <button
                      onClick={refreshUsage}
                      disabled={usageLoading}
                      className="mt-4 text-xs text-amber-400 hover:text-amber-300 transition-colors inline-flex items-center gap-1"
                    >
                      {usageLoading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                      Refresh usage
                    </button>
                  </div>
                )}
              </div>

              {/* API access card */}
              <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Key size={14} />
                  API Access
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-slate-500 mb-1.5">Base URL</div>
                    <code className="text-sm text-amber-400 bg-slate-900 px-3 py-1.5 rounded block font-mono">
                      https://api.daybreakscan.com/api/v1
                    </code>
                  </div>

                  <div>
                    <div className="text-xs text-slate-500 mb-2">Endpoints</div>
                    <div className="space-y-2">
                      <div className="bg-slate-900 rounded px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">GET</span>
                          <code className="text-xs text-slate-300 font-mono">/health</code>
                          <span className="text-xs text-slate-600 ml-auto">Public</span>
                        </div>
                      </div>
                      <div className="bg-slate-900 rounded px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">GET</span>
                          <code className="text-xs text-slate-300 font-mono">/auth/nonce?wallet=ADDRESS</code>
                          <span className="text-xs text-slate-600 ml-auto">Public</span>
                        </div>
                      </div>
                      <div className="bg-slate-900 rounded px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">POST</span>
                          <code className="text-xs text-slate-300 font-mono">/auth/verify</code>
                          <span className="text-xs text-slate-600 ml-auto">Public</span>
                        </div>
                      </div>
                      <div className="bg-slate-900 rounded px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">GET</span>
                          <code className="text-xs text-slate-300 font-mono">/auth/usage</code>
                          <span className="text-xs text-amber-500/60 ml-auto flex items-center gap-1">
                            <Shield size={10} /> Auth
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-900 rounded px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">GET</span>
                          <code className="text-xs text-slate-300 font-mono">/deployer/:token_address</code>
                          <span className="text-xs text-amber-500/60 ml-auto flex items-center gap-1">
                            <Shield size={10} /> Auth
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-900 rounded px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">GET</span>
                          <code className="text-xs text-slate-300 font-mono">/wallet/:wallet_address</code>
                          <span className="text-xs text-amber-500/60 ml-auto flex items-center gap-1">
                            <Shield size={10} /> Auth
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-900 rounded px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">GET</span>
                          <code className="text-xs text-slate-300 font-mono">/paid/deployer/:token_address</code>
                          <span className="text-xs text-purple-400/60 ml-auto flex items-center gap-1">
                            x402
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-900 rounded px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">GET</span>
                          <code className="text-xs text-slate-300 font-mono">/paid/wallet/:wallet_address</code>
                          <span className="text-xs text-purple-400/60 ml-auto flex items-center gap-1">
                            x402
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-900 rounded px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">GET</span>
                          <code className="text-xs text-slate-300 font-mono">/x402/stats</code>
                          <span className="text-xs text-slate-600 ml-auto">Public</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-700">
                    <div className="text-xs text-slate-500 mb-1.5">Authentication</div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Sign a nonce with your Solana wallet to receive a JWT.
                      Include it as <code className="text-amber-400">Authorization: Bearer &lt;token&gt;</code> on protected endpoints.
                      Tokens expire after 24 hours.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-700">
                    <div className="text-xs text-slate-500 mb-1.5">Rate Limits</div>
                    <p className="text-xs text-slate-400">
                      Free tier: <span className="text-white font-semibold">{usage?.scans_limit || 3} scans per day</span> per wallet.
                      Cached results (30 min TTL) do not count against your limit.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-700">
                    <div className="text-xs text-slate-500 mb-1.5">x402 Paid Access (Agents & Bots)</div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      The <code className="text-purple-400">/paid/*</code> endpoints accept x402 payments — <span className="text-white font-semibold">$0.01 USDC</span> per scan on Solana.
                      No JWT needed. Send an <code className="text-amber-400">X-PAYMENT</code> header with a signed payment payload.
                      Verified via the Coinbase facilitator. Ideal for AI agents and MCP integrations.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick scan link */}
              <div className="text-center">
                <a
                  href="/scan"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors"
                >
                  Go to Scanner
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
