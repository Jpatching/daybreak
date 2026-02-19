'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import useAuth from '@/hooks/useAuth';
import { fetchUsage, fetchScanHistory } from '@/lib/api';
import {
  Wallet,
  Shield,
  Clock,
  Loader2,
  ExternalLink,
  Zap,
  Key,
  CheckCircle2,
  AlertTriangle,
  Skull,
  ArrowRight,
  History,
} from 'lucide-react';

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

const verdictConfig = {
  CLEAN: { color: 'text-green-400', bg: 'bg-green-500/10', icon: CheckCircle2 },
  SUSPICIOUS: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', icon: AlertTriangle },
  SERIAL_RUGGER: { color: 'text-red-400', bg: 'bg-red-500/10', icon: Skull },
};

export default function ProfileClient() {
  const router = useRouter();
  const { connected } = useWallet();
  const { isAuthenticated, token, wallet, login, logout, loading: authLoading, error: authError } = useAuth();
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  const loadHistory = useCallback(async () => {
    if (!token) return;
    setHistoryLoading(true);
    try {
      const data = await fetchScanHistory(token);
      setHistory(data || []);
    } catch {
      // non-critical
    } finally {
      setHistoryLoading(false);
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
      loadHistory();
    }
  }, [isAuthenticated, token, refreshUsage, loadHistory]);

  const limit = usage ? Math.min(usage.scans_limit, 10) : 3;
  const used = usage ? Math.min(usage.scans_used, limit) : 0;
  const remaining = Math.max(0, limit - used);
  const pct = (used / limit) * 100;
  const barColor = remaining === 0 ? 'bg-red-500' : remaining <= 1 ? 'bg-yellow-500' : 'bg-amber-500';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-2" style={gradientTextStyle}>
            Profile
          </h1>
          <p className="text-slate-400 text-center mb-10">
            Your wallet, scan history, and API access.
          </p>

          {!connected && (
            <div className="text-center py-16">
              <Wallet className="w-14 h-14 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 mb-4">Connect your wallet to view your profile</p>
              <WalletMultiButton className="!bg-amber-500 !text-slate-900 !font-semibold !rounded-lg !text-base !h-12 !px-8 hover:!bg-amber-400 mx-auto" />
            </div>
          )}

          {connected && !isAuthenticated && authLoading && (
            <div className="text-center py-16">
              <Loader2 className="w-10 h-10 animate-spin text-amber-400 mx-auto mb-4" />
              <p className="text-slate-400">Authenticating wallet...</p>
            </div>
          )}

          {authError && (
            <div className="text-center py-8">
              <p className="text-red-400 mb-4">{authError}</p>
              <button onClick={login} className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg">
                Try Again
              </button>
            </div>
          )}

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
                  Scan Usage
                </h3>

                {usageLoading && !usage && (
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Loader2 size={14} className="animate-spin" />
                    Loading usage...
                  </div>
                )}

                {usage && (
                  <div>
                    <div className="grid grid-cols-3 gap-6 mb-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-white">{remaining}</div>
                        <div className="text-xs text-slate-500 mt-1">Remaining Today</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-slate-400">{used}</div>
                        <div className="text-xs text-slate-500 mt-1">Used Today</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-amber-400">{limit}</div>
                        <div className="text-xs text-slate-500 mt-1">Daily Limit</div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-400">{used} of {limit} free scans used today</span>
                        {remaining <= 0 ? (
                          <span className="text-red-400 font-semibold">Limit reached</span>
                        ) : (
                          <span className="text-slate-500">{remaining} left</span>
                        )}
                      </div>
                      <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock size={12} />
                        <span>Resets 24 hours after first scan</span>
                      </div>
                      <button
                        onClick={refreshUsage}
                        disabled={usageLoading}
                        className="text-xs text-amber-400 hover:text-amber-300 transition-colors inline-flex items-center gap-1"
                      >
                        {usageLoading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                        Refresh
                      </button>
                    </div>

                    <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <p className="text-sm text-amber-400 font-medium mb-1">Paid Scans</p>
                      <p className="text-xs text-slate-400 mb-3">
                        Pay $0.01 USDC per scan. No subscription, no commitment.
                      </p>
                      <a
                        href="/scan"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg text-sm transition-colors"
                      >
                        Scan a Token <ArrowRight size={14} />
                      </a>
                      <p className="text-[10px] text-slate-600 mt-2">Powered by x402 protocol on Solana</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Scan History */}
              <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <History size={14} />
                  Scan History
                </h3>

                {historyLoading && history.length === 0 && (
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Loader2 size={14} className="animate-spin" />
                    Loading history...
                  </div>
                )}

                {!historyLoading && history.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-slate-500 text-sm">No scans yet. Your scan history will appear here.</p>
                    <a
                      href="/scan"
                      className="inline-flex items-center gap-1 mt-3 text-sm text-amber-400 hover:text-amber-300"
                    >
                      Scan your first token <ArrowRight size={14} />
                    </a>
                  </div>
                )}

                {history.length > 0 && (
                  <div className="space-y-2">
                    {history.map((scan, i) => {
                      const v = verdictConfig[scan.verdict] || verdictConfig.SUSPICIOUS;
                      const Icon = v.icon;
                      return (
                        <button
                          key={`${scan.token_address}-${i}`}
                          onClick={() => router.push(`/scan/${scan.token_address}`)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-700/50 hover:border-amber-500/30 transition-all text-left ${v.bg}`}
                        >
                          <Icon size={16} className={v.color} />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-white font-medium">
                              {scan.token_name || scan.token_symbol || truncAddr(scan.token_address)}
                            </span>
                            <span className="text-xs text-slate-500 ml-2 font-mono hidden sm:inline">
                              {truncAddr(scan.token_address)}
                            </span>
                            <span className="block text-[10px] text-slate-600 mt-0.5">
                              {new Date(scan.scanned_at + 'Z').toLocaleDateString(undefined, {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className={`text-sm font-bold font-mono ${v.color}`}>{scan.score}/100</span>
                            <span className={`block text-[10px] uppercase tracking-wider ${v.color}`}>
                              {scan.verdict.replace('_', ' ')}
                            </span>
                          </div>
                        </button>
                      );
                    })}
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
                      {[
                        { method: 'GET', path: '/health', auth: 'Public' },
                        { method: 'GET', path: '/auth/nonce?wallet=ADDRESS', auth: 'Public' },
                        { method: 'POST', path: '/auth/verify', auth: 'Public', methodColor: 'blue' },
                        { method: 'GET', path: '/auth/usage', auth: 'Auth' },
                        { method: 'GET', path: '/deployer/:token_address', auth: 'Auth' },
                        { method: 'GET', path: '/wallet/:wallet_address', auth: 'Auth' },
                        { method: 'GET', path: '/paid/deployer/:token_address', auth: 'x402' },
                        { method: 'GET', path: '/paid/wallet/:wallet_address', auth: 'x402' },
                        { method: 'GET', path: '/x402/stats', auth: 'Public' },
                      ].map((ep) => (
                        <div key={ep.path} className="bg-slate-900 rounded px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                              ep.methodColor === 'blue' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                            }`}>{ep.method}</span>
                            <code className="text-xs text-slate-300 font-mono">{ep.path}</code>
                            <span className={`text-xs ml-auto ${
                              ep.auth === 'Auth' ? 'text-amber-500/60' : ep.auth === 'x402' ? 'text-purple-400/60' : 'text-slate-600'
                            }`}>
                              {ep.auth === 'Auth' && <Shield size={10} className="inline mr-1" />}
                              {ep.auth}
                            </span>
                          </div>
                        </div>
                      ))}
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
                      Free tier: <span className="text-white font-semibold">3 scans per day</span> per wallet.
                      Cached results (30 min TTL) do not count against your limit.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-700">
                    <div className="text-xs text-slate-500 mb-1.5">x402 Paid Access</div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      The <code className="text-purple-400">/paid/*</code> endpoints accept x402 payments — <span className="text-white font-semibold">$0.01 USDC</span> per scan on Solana.
                      No JWT needed. Send an <code className="text-amber-400">X-PAYMENT</code> header with a signed payment payload.
                    </p>
                  </div>
                </div>
              </div>

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
