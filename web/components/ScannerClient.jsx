'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import useAuth from '@/hooks/useAuth';
import { scanToken, scanTokenPaid, guestScanToken, fetchUsage, fetchRecentScans, PaymentRequiredError } from '@/lib/api';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  Loader2,
  Wallet,
  Skull,
  Users,
  Eye,
  TrendingUp,
  ExternalLink,
  Clock,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Activity,
  Zap,
  Globe,
  Lock,
  Unlock,
  DollarSign,
} from 'lucide-react';

// ---------- Gradient ----------

const gradientTextStyle = {
  background: 'linear-gradient(180deg, #ffffff 0%, #f59e0b 50%, #d97706 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  filter: 'drop-shadow(0 0 15px rgba(245, 158, 11, 0.4))',
};

// ---------- Reputation Gauge ----------

function ReputationGauge({ score }) {
  const c = 2 * Math.PI * 45;
  const offset = c - (score / 100) * c;
  const color = score >= 70 ? '#22c55e' : score >= 30 ? '#eab308' : '#ef4444';
  return (
    <div className="relative w-28 h-28">
      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle cx="50" cy="50" r="45" fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[10px] text-slate-500">/100</span>
      </div>
    </div>
  );
}

// ---------- Verdict Badge ----------

function VerdictBadge({ verdict }) {
  const config = {
    CLEAN: { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle2 },
    SUSPICIOUS: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: AlertTriangle },
    SERIAL_RUGGER: { bg: 'bg-red-500/20', text: 'text-red-400', icon: Skull },
  };
  const c = config[verdict] || config.SUSPICIOUS;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${c.bg} ${c.text}`}>
      <Icon size={16} />
      {verdict.replace('_', ' ')}
    </span>
  );
}

// ---------- Usage Badge ----------

function UsageBadge({ usage }) {
  if (!usage) return null;
  const limit = Math.min(usage.scans_limit, 10); // cap display at reasonable number
  const used = Math.min(usage.scans_used, limit);
  const remaining = Math.max(0, limit - used);
  const pct = (used / limit) * 100;
  const barColor = remaining === 0 ? 'bg-red-500' : remaining <= 1 ? 'bg-yellow-500' : 'bg-amber-500';
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-800/80 rounded-lg border border-slate-700">
      <Clock size={14} className="text-slate-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-400">
            {used}/{limit} free scans used today
          </span>
          <span className={remaining === 0 ? 'text-red-400 font-semibold' : 'text-slate-500'}>
            {remaining} remaining
          </span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

// ---------- Score Breakdown ----------

function ScoreBreakdownCard({ breakdown }) {
  const [open, setOpen] = useState(false);
  if (!breakdown) return null;

  const components = [
    { label: 'Death Rate', earned: breakdown.rug_rate_component, max: 40 },
    { label: 'Token Count', earned: breakdown.token_count_component, max: 20 },
    { label: 'Lifespan', earned: breakdown.lifespan_component, max: 20 },
    { label: 'Cluster', earned: breakdown.cluster_component, max: 20 },
  ];

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-700/20 transition-colors"
      >
        <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-2">
          <Activity size={14} />
          Score Breakdown
        </h3>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {components.map((c) => (
            <div key={c.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">{c.label}</span>
                <span className="text-slate-300 font-mono">{c.earned.toFixed(1)} / {c.max}</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${(c.earned / c.max) * 100}%` }}
                />
              </div>
            </div>
          ))}
          {breakdown.risk_deductions < 0 && (
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-700">
              <span className="text-red-400">Risk Deductions</span>
              <span className="text-red-400 font-mono font-semibold">{breakdown.risk_deductions}</span>
            </div>
          )}
          <div className="pt-2 border-t border-slate-700 space-y-1">
            {breakdown.details?.map((d, i) => (
              <p key={i} className={`text-xs ${d.includes('-') && d.includes('points') && !d.includes('/') ? 'text-red-400' : 'text-slate-500'}`}>
                {d}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Payment Prompt ----------

function PaymentPrompt({ paymentInfo, onPay, paying }) {
  if (!paymentInfo) return null;

  if (paymentInfo.guestLimitReached) {
    return (
      <div className="text-center py-10">
        <Wallet className="w-12 h-12 text-amber-400/60 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Guest scan limit reached</h3>
        <p className="text-slate-400 text-sm mb-6">
          Connect your wallet for 3 free scans per day.
        </p>
        <WalletMultiButton className="!bg-amber-500 !text-slate-900 !font-semibold !rounded-lg !text-base !h-12 !px-8 hover:!bg-amber-400 mx-auto" />
        <p className="text-xs text-slate-600 mt-4">
          Signature-based auth. No transactions, no funds at risk.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-10">
      <CreditCard className="w-12 h-12 text-amber-400/60 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-white mb-2">Free scans used up</h3>
      <p className="text-slate-400 text-sm mb-1">
        You've used all 3 free scans for today.
      </p>
      <p className="text-slate-400 text-sm mb-6">
        Pay <span className="text-amber-400 font-semibold">${paymentInfo.priceUsd} USDC</span> on Solana for an extra scan.
      </p>
      <button
        onClick={onPay}
        disabled={paying}
        className="inline-flex items-center gap-2 px-8 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors disabled:opacity-50"
      >
        {paying ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Processing payment...
          </>
        ) : (
          <>
            <CreditCard size={18} />
            Pay ${paymentInfo.priceUsd} USDC & Scan
          </>
        )}
      </button>
      <p className="text-xs text-slate-600 mt-4">
        Payment via x402 protocol. USDC on Solana mainnet.
      </p>
    </div>
  );
}

// ---------- Helpers ----------

function truncAddr(addr) {
  if (!addr) return '...';
  return addr.slice(0, 4) + '...' + addr.slice(-4);
}

function solscanUrl(addr) {
  return `https://solscan.io/account/${addr}`;
}

const ERROR_MESSAGES = {
  AUTH_REQUIRED: 'Please connect your wallet and sign in to scan.',
  RATE_LIMITED: 'Daily scan limit reached. You get 3 free scans per day.',
  NOT_FOUND: 'Token not found. Make sure this is a valid Solana token address.',
  SERVICE_UNAVAILABLE: 'Backend is temporarily unavailable. Try again in a moment.',
};

const SCAN_STEPS = [
  'Resolving token metadata...',
  'Finding deployer wallet...',
  'Scanning deployer history...',
  'Checking token statuses...',
  'Analyzing funding cluster...',
  'Calculating reputation...',
];

// ---------- Idle State (recent scans feed) ----------

function ScannerIdleState({ connected, isAuthenticated }) {
  const [recentScans, setRecentScans] = useState([]);
  const router = useRouter();

  useEffect(() => {
    fetchRecentScans().then(data => { if (data?.length) setRecentScans(data); }).catch(() => {});
  }, []);

  const verdictConfig = {
    CLEAN: { color: 'text-green-400', bg: 'bg-green-500/10', icon: CheckCircle2 },
    SUSPICIOUS: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', icon: AlertTriangle },
    SERIAL_RUGGER: { color: 'text-red-400', bg: 'bg-red-500/10', icon: Skull },
  };

  return (
    <div className="py-8">
      {!connected && (
        <div className="text-center mb-8">
          <p className="text-slate-400 mb-1">Paste a Solana token address above and click Scan</p>
          <p className="text-xs text-slate-500">1 free scan without wallet. <span className="text-amber-400/70">Connect wallet for 3 free scans/day.</span></p>
        </div>
      )}
      {connected && isAuthenticated && (
        <div className="text-center mb-8">
          <p className="text-slate-400">Paste a Solana token address above and click Scan</p>
          <p className="text-xs text-slate-500 mt-1">Works with any Pump.fun, Raydium, or PumpSwap token</p>
        </div>
      )}

      {recentScans.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">Recently Scanned</p>
          <div className="space-y-2">
            {recentScans.slice(0, 4).map((scan, i) => {
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
        </div>
      )}
    </div>
  );
}

// ---------- Main ----------

export default function ScannerClient({ initialAddress }) {
  const router = useRouter();
  const { connected, publicKey, signMessage } = useWallet();
  const { isAuthenticated, token, login, loading: authLoading, error: authError } = useAuth();

  const [query, setQuery] = useState(initialAddress || '');
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [usage, setUsage] = useState(null);

  // x402 payment state
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [paying, setPaying] = useState(false);

  // Fetch usage on auth
  const refreshUsage = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchUsage(token);
      setUsage(data);
    } catch {
      // non-critical
    }
  }, [token]);

  useEffect(() => {
    if (isAuthenticated && token) {
      refreshUsage();
    }
  }, [isAuthenticated, token, refreshUsage]);

  // Auto-login when wallet connects
  useEffect(() => {
    if (connected && !isAuthenticated && !authLoading) {
      login();
    }
  }, [connected, isAuthenticated, authLoading, login]);

  // Scan when initialAddress changes
  useEffect(() => {
    if (initialAddress) {
      doScan(initialAddress);
    }
  }, [initialAddress, isAuthenticated, token]);

  async function doScan(address) {
    setScanning(true);
    setResult(null);
    setError(null);
    setPaymentInfo(null);
    setScanStep(0);

    const stepInterval = setInterval(() => {
      setScanStep(prev => (prev < SCAN_STEPS.length - 1 ? prev + 1 : prev));
    }, 2500);

    try {
      let data;
      if (isAuthenticated && token) {
        data = await scanToken(address, token);
      } else {
        data = await guestScanToken(address);
        if (data.guestLimitReached) {
          setPaymentInfo({
            guestLimitReached: true,
            priceUsd: data.price_usd || 0.01,
            details: data.details,
            address,
          });
          return;
        }
      }
      setResult(data);
      if (data.usage) setUsage(data.usage);
    } catch (err) {
      if (err instanceof PaymentRequiredError) {
        setPaymentInfo({
          priceUsd: err.priceUsd || 0.01,
          details: err.details,
          address,
        });
      } else {
        setError(err.message);
      }
      refreshUsage();
    } finally {
      clearInterval(stepInterval);
      setScanning(false);
    }
  }

  async function handlePayAndScan() {
    if (!paymentInfo || !publicKey || !signMessage) return;

    setPaying(true);
    setError(null);

    try {
      const details = paymentInfo.details;
      if (!details?.accepts?.length) {
        throw new Error('No payment options available');
      }

      const option = details.accepts[0];
      const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const timestamp = Math.floor(Date.now() / 1000);

      const message = JSON.stringify({
        scheme: option.scheme,
        network: option.network,
        asset: option.asset,
        amount: option.maxAmountRequired,
        payTo: option.payTo,
        nonce,
        timestamp,
        validUntil: option.validUntil ?? timestamp + 300,
      });

      const messageBytes = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', messageBytes);
      const hashArray = new Uint8Array(hashBuffer);

      const signatureBytes = await signMessage(hashArray);

      const bs58Module = await import('bs58');
      const signature = bs58Module.default.encode(signatureBytes);

      const payload = {
        paymentOption: option,
        signature,
        payer: publicKey.toBase58(),
        nonce,
        timestamp,
      };

      const paymentHeader = btoa(JSON.stringify(payload));

      setScanning(true);
      setScanStep(0);
      const stepInterval = setInterval(() => {
        setScanStep(prev => (prev < SCAN_STEPS.length - 1 ? prev + 1 : prev));
      }, 2500);

      try {
        const data = await scanTokenPaid(paymentInfo.address, paymentHeader);
        setResult(data);
        setPaymentInfo(null);
      } finally {
        clearInterval(stepInterval);
        setScanning(false);
      }
    } catch (err) {
      setPaymentInfo(null);
      setError(`Payment failed: ${err.message}`);
    } finally {
      setPaying(false);
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) router.push(`/scan/${query.trim()}`);
  };

  const canScan = !scanning;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-2" style={gradientTextStyle}>
            Deployer Reputation Scanner
          </h1>
          <p className="text-slate-400 text-center mb-6">
            Find out if the deployer has rugged before. Free for 3 scans/day.
          </p>

          {isAuthenticated && usage && (
            <div className="mb-6">
              <UsageBadge usage={usage} />
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-3 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Solana token address..."
                className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 font-mono text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={!canScan}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {scanning ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              Scan
            </button>
          </form>

          {connected && !isAuthenticated && authLoading && (
            <div className="text-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Authenticating wallet...</p>
            </div>
          )}

          {authError && (
            <div className="text-center py-4">
              <p className="text-red-400 text-sm mb-2">{authError}</p>
              <button onClick={login} className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg text-sm">
                Try Again
              </button>
            </div>
          )}

          {!scanning && !result && !paymentInfo && !initialAddress && (
            <ScannerIdleState connected={connected} isAuthenticated={isAuthenticated} />
          )}

          {scanning && (
            <div className="text-center py-16">
              <Loader2 className="w-10 h-10 animate-spin text-amber-400 mx-auto mb-6" />
              <div className="space-y-2 max-w-xs mx-auto">
                {SCAN_STEPS.map((step, i) => (
                  <div key={i} className={`flex items-center gap-2 text-sm transition-all duration-300 ${
                    i < scanStep ? 'text-green-400' : i === scanStep ? 'text-amber-400' : 'text-slate-600'
                  }`}>
                    {i < scanStep ? (
                      <CheckCircle2 size={14} className="flex-shrink-0" />
                    ) : i === scanStep ? (
                      <Loader2 size={14} className="animate-spin flex-shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-slate-600 flex-shrink-0" />
                    )}
                    {step}
                  </div>
                ))}
              </div>
            </div>
          )}

          {paymentInfo && !scanning && !result && (
            <PaymentPrompt
              paymentInfo={paymentInfo}
              onPay={handlePayAndScan}
              paying={paying}
            />
          )}

          {error && !scanning && !paymentInfo && (
            <div className="text-center py-16">
              <XCircle className="w-12 h-12 text-red-500/50 mx-auto mb-4" />
              <p className="text-slate-400 mb-2">{ERROR_MESSAGES[error] || `Error: ${error}`}</p>
              {error === 'RATE_LIMITED' && usage && (
                <p className="text-xs text-slate-600 mt-2">
                  {usage.scans_used}/{usage.scans_limit} scans used today. Resets in 24 hours.
                </p>
              )}
              {error === 'AUTH_REQUIRED' && (
                <WalletMultiButton className="!bg-amber-500 !text-slate-900 !font-semibold !rounded-lg !text-sm !h-10 !px-6 hover:!bg-amber-400 mx-auto mt-4" />
              )}
            </div>
          )}

          {result && !scanning && (
            <div className="space-y-6">
              {/* Token card + market data */}
              <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-2xl font-bold text-white">
                        {result.token.name} ({result.token.symbol})
                      </h2>
                      {result.rugcheck?.risk_level && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          result.rugcheck.risk_level === 'Good' ? 'bg-green-500/20 text-green-400'
                            : result.rugcheck.risk_level === 'Warning' ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          RugCheck: {result.rugcheck.risk_level}
                        </span>
                      )}
                    </div>
                    <a
                      href={solscanUrl(result.token.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-500 font-mono hover:text-amber-400 transition-colors inline-flex items-center gap-1"
                    >
                      {result.token.address}
                      <ExternalLink size={10} />
                    </a>
                    {result.market_data && (
                      <div className="flex flex-wrap gap-4 mt-3">
                        {result.market_data.price_usd != null && (
                          <div className="text-sm">
                            <span className="text-slate-500">Price: </span>
                            <span className="text-white font-mono">
                              ${result.market_data.price_usd < 0.01
                                ? result.market_data.price_usd.toExponential(2)
                                : result.market_data.price_usd.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                            </span>
                          </div>
                        )}
                        {result.market_data.price_change_24h != null && (
                          <div className="text-sm">
                            <span className="text-slate-500">24h: </span>
                            <span className={result.market_data.price_change_24h >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {result.market_data.price_change_24h >= 0 ? '+' : ''}{result.market_data.price_change_24h.toFixed(1)}%
                            </span>
                          </div>
                        )}
                        {result.market_data.volume_24h != null && result.market_data.volume_24h > 0 && (
                          <div className="text-sm">
                            <span className="text-slate-500">Vol: </span>
                            <span className="text-slate-300">${(result.market_data.volume_24h / 1000).toFixed(1)}K</span>
                          </div>
                        )}
                        {result.market_data.fdv != null && (
                          <div className="text-sm">
                            <span className="text-slate-500">FDV: </span>
                            <span className="text-slate-300">${result.market_data.fdv >= 1e6
                              ? (result.market_data.fdv / 1e6).toFixed(1) + 'M'
                              : (result.market_data.fdv / 1e3).toFixed(1) + 'K'}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {result.market_data?.socials && (
                      <div className="flex gap-3 mt-2">
                        {result.market_data.socials.website && (
                          <a href={result.market_data.socials.website} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-slate-500 hover:text-amber-400 inline-flex items-center gap-1">
                            <Globe size={12} /> Website
                          </a>
                        )}
                        {result.market_data.socials.twitter && (
                          <a href={result.market_data.socials.twitter} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-slate-500 hover:text-amber-400 inline-flex items-center gap-1">
                            <ExternalLink size={10} /> Twitter
                          </a>
                        )}
                        {result.market_data.socials.telegram && (
                          <a href={result.market_data.socials.telegram} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-slate-500 hover:text-amber-400 inline-flex items-center gap-1">
                            <ExternalLink size={10} /> Telegram
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center">
                    <ReputationGauge score={result.deployer.reputation_score} />
                    <VerdictBadge verdict={result.verdict} />
                  </div>
                </div>
              </div>

              {/* Deployer stats */}
              <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Shield size={14} />
                  Deployer
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Wallet</div>
                    <a
                      href={result.evidence?.deployer_url || solscanUrl(result.deployer.wallet)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono text-amber-400 hover:underline inline-flex items-center gap-1"
                    >
                      {truncAddr(result.deployer.wallet)}
                      <ExternalLink size={10} />
                    </a>
                    {result.deployer.deployer_is_burner && (
                      <span className="ml-2 px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold rounded-full uppercase tracking-wider">
                        Burner
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">SOL Balance</div>
                    <div className={`text-lg font-semibold ${
                      result.deployer.sol_balance != null && result.deployer.sol_balance < 0.1 ? 'text-red-400' : 'text-slate-300'
                    }`}>
                      {result.deployer.sol_balance != null ? `${result.deployer.sol_balance.toFixed(2)}` : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Tokens Created</div>
                    <div className="text-lg font-semibold text-white">{result.deployer.tokens_created}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Tokens Dead</div>
                    <div className={`text-lg font-semibold ${result.deployer.tokens_dead > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {result.deployer.tokens_dead}
                      {result.deployer.tokens_unverified > 0 && (
                        <span className="text-xs text-yellow-500 ml-1">+ {result.deployer.tokens_unverified} unverified</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Death Rate</div>
                    <div className={`text-lg font-semibold ${
                      (result.deployer.death_rate ?? result.deployer.rug_rate) > 0.7 ? 'text-red-400'
                        : (result.deployer.death_rate ?? result.deployer.rug_rate) > 0.3 ? 'text-yellow-400'
                        : 'text-green-400'
                    }`}>
                      {((result.deployer.death_rate ?? result.deployer.rug_rate) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                {(result.deployer.first_seen || result.deployer.last_seen) && (
                  <div className="grid grid-cols-2 gap-6 mt-4 pt-4 border-t border-slate-700">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">First Seen</div>
                      <div className="text-sm text-slate-300">
                        {result.deployer.first_seen ? new Date(result.deployer.first_seen).toLocaleDateString() : 'Unknown'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Last Seen</div>
                      <div className="text-sm text-slate-300">
                        {result.deployer.last_seen ? new Date(result.deployer.last_seen).toLocaleDateString() : 'Unknown'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Token Risk Analysis */}
              {result.token_risks && (
                <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                  <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Zap size={14} />
                    Token Risk Analysis
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${result.token_risks.mint_authority === null ? 'bg-green-400' : 'bg-red-400'}`} />
                      <div>
                        <div className="text-xs text-slate-500">Mint Authority</div>
                        <div className={`text-sm font-medium ${result.token_risks.mint_authority === null ? 'text-green-400' : 'text-red-400'}`}>
                          {result.token_risks.mint_authority === null ? 'Revoked' : 'ACTIVE'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${result.token_risks.freeze_authority === null ? 'bg-green-400' : 'bg-red-400'}`} />
                      <div>
                        <div className="text-xs text-slate-500">Freeze Authority</div>
                        <div className={`text-sm font-medium ${result.token_risks.freeze_authority === null ? 'text-green-400' : 'text-red-400'}`}>
                          {result.token_risks.freeze_authority === null ? 'Revoked' : 'ACTIVE'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        result.token_risks.deployer_holdings_pct === null ? 'bg-slate-500'
                          : result.token_risks.deployer_holdings_pct > 30 ? 'bg-red-400'
                          : result.token_risks.deployer_holdings_pct > 10 ? 'bg-yellow-400'
                          : 'bg-green-400'
                      }`} />
                      <div>
                        <div className="text-xs text-slate-500">Deployer Holdings</div>
                        <div className={`text-sm font-medium ${
                          result.token_risks.deployer_holdings_pct === null ? 'text-slate-400'
                            : result.token_risks.deployer_holdings_pct > 30 ? 'text-red-400'
                            : result.token_risks.deployer_holdings_pct > 10 ? 'text-yellow-400'
                            : 'text-green-400'
                        }`}>
                          {result.token_risks.deployer_holdings_pct !== null
                            ? `${result.token_risks.deployer_holdings_pct.toFixed(1)}%`
                            : 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        result.token_risks.top_holder_pct === null ? 'bg-slate-500'
                          : result.token_risks.top_holder_pct > 80 ? 'bg-red-400'
                          : result.token_risks.top_holder_pct > 40 ? 'bg-yellow-400'
                          : 'bg-green-400'
                      }`} />
                      <div>
                        <div className="text-xs text-slate-500">Top Holder</div>
                        <div className={`text-sm font-medium ${
                          result.token_risks.top_holder_pct === null ? 'text-slate-400'
                            : result.token_risks.top_holder_pct > 80 ? 'text-red-400'
                            : result.token_risks.top_holder_pct > 40 ? 'text-yellow-400'
                            : 'text-green-400'
                        }`}>
                          {result.token_risks.top_holder_pct !== null
                            ? `${result.token_risks.top_holder_pct.toFixed(1)}%`
                            : 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        result.token_risks.bundle_detected === null ? 'bg-slate-500'
                          : result.token_risks.bundle_detected ? 'bg-red-400'
                          : 'bg-green-400'
                      }`} />
                      <div>
                        <div className="text-xs text-slate-500">Bundled Launch</div>
                        <div className={`text-sm font-medium ${
                          result.token_risks.bundle_detected === null ? 'text-slate-400'
                            : result.token_risks.bundle_detected ? 'text-red-400'
                            : 'text-green-400'
                        }`}>
                          {result.token_risks.bundle_detected === null
                            ? 'N/A'
                            : result.token_risks.bundle_detected ? 'DETECTED' : 'Not detected'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        result.token_risks.lp_locked === null ? 'bg-slate-500'
                          : result.token_risks.lp_locked ? 'bg-green-400'
                          : 'bg-red-400'
                      }`} />
                      <div>
                        <div className="text-xs text-slate-500">LP Locked</div>
                        <div className={`text-sm font-medium ${
                          result.token_risks.lp_locked === null ? 'text-slate-400'
                            : result.token_risks.lp_locked ? 'text-green-400'
                            : 'text-red-400'
                        }`}>
                          {result.token_risks.lp_locked === null
                            ? 'N/A'
                            : result.token_risks.lp_locked
                            ? `Locked${result.token_risks.lp_lock_pct ? ` (${result.token_risks.lp_lock_pct.toFixed(0)}%)` : ''}`
                            : 'UNLOCKED'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {result.token_risks === null && result.confidence?.token_risks_checked === false && (
                <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                  <p className="text-xs text-slate-500 text-center">Risk checks unavailable for this token</p>
                </div>
              )}

              {/* RugCheck Cross-Reference */}
              {result.rugcheck && result.rugcheck.risks && result.rugcheck.risks.length > 0 && (
                <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                  <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Shield size={14} />
                    RugCheck Analysis
                    {result.rugcheck.risk_score != null && (
                      <span className="text-slate-500 font-normal normal-case ml-2">
                        Score: {result.rugcheck.risk_score}
                      </span>
                    )}
                  </h3>
                  <div className="space-y-2">
                    {result.rugcheck.risks.slice(0, 10).map((risk, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            risk.level === 'good' || risk.level === 'info' ? 'bg-green-400'
                              : risk.level === 'warn' || risk.level === 'warning' ? 'bg-yellow-400'
                              : 'bg-red-400'
                          }`} />
                          <span className="text-slate-300">{risk.name}</span>
                        </div>
                        <span className={`text-xs ${
                          risk.level === 'good' || risk.level === 'info' ? 'text-green-400'
                            : risk.level === 'warn' || risk.level === 'warning' ? 'text-yellow-400'
                            : 'text-red-400'
                        }`}>
                          {risk.description || risk.level}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <ScoreBreakdownCard breakdown={result.score_breakdown} />

              {/* Token list */}
              {result.deployer.tokens && result.deployer.tokens.length > 0 && (
                <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                  <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <TrendingUp size={14} />
                    Deployer's Tokens ({result.deployer.tokens.length})
                    {(result.deployer.tokens_unverified > 0 || (result.confidence?.tokens_unverified || 0) > 0) && (
                      <span className="text-yellow-500 font-normal normal-case">
                        + {result.confidence?.tokens_unverified || result.deployer.tokens_unverified} unverified
                      </span>
                    )}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-700">
                          <th className="text-left pb-3 pr-4">Token</th>
                          <th className="text-left pb-3 pr-4">Symbol</th>
                          <th className="text-left pb-3 pr-4">Status</th>
                          <th className="text-right pb-3 pr-4">Price</th>
                          <th className="text-right pb-3 pr-4">24h</th>
                          <th className="text-right pb-3 pr-4">Liquidity</th>
                          <th className="text-right pb-3 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.deployer.tokens.slice(0, 50).map((t) => (
                          <tr key={t.address} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                            <td className="py-2 pr-4">
                              <a
                                href={solscanUrl(t.address)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-300 hover:text-amber-400 transition-colors font-mono text-xs inline-flex items-center gap-1"
                              >
                                {t.name || truncAddr(t.address)}
                                <ExternalLink size={10} />
                              </a>
                            </td>
                            <td className="py-2 pr-4 text-slate-400">{t.symbol || '???'}</td>
                            <td className="py-2 pr-4">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                t.alive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                              }`}>
                                {t.alive ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                                {t.alive ? 'Alive' : 'Dead'}
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-right font-mono text-xs text-slate-400">
                              {t.price_usd != null
                                ? `$${t.price_usd < 0.01 ? t.price_usd.toExponential(1) : t.price_usd.toFixed(4)}`
                                : '-'}
                            </td>
                            <td className={`py-2 pr-4 text-right font-mono text-xs ${
                              t.price_change_24h == null ? 'text-slate-600'
                                : t.price_change_24h >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {t.price_change_24h != null ? `${t.price_change_24h >= 0 ? '+' : ''}${t.price_change_24h.toFixed(1)}%` : '-'}
                            </td>
                            <td className="py-2 pr-4 text-right font-mono text-xs text-slate-400">
                              ${t.liquidity?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}
                            </td>
                            <td className="py-2 text-right">
                              <a
                                href={t.dexscreener_url || `https://dexscreener.com/solana/${t.address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-500 hover:text-amber-400 transition-colors"
                                title="View on DexScreener"
                              >
                                <ExternalLink size={12} />
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {result.deployer.tokens.length > 50 && (
                      <p className="text-xs text-slate-600 mt-3">Showing 50 of {result.deployer.tokens.length} tokens</p>
                    )}
                  </div>
                </div>
              )}

              {/* Funding trace */}
              <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Users size={14} />
                  Funding & Cluster
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Funding Source</div>
                    {result.funding.source_wallet ? (
                      <div>
                        <a
                          href={result.evidence?.funding_source_url || solscanUrl(result.funding.source_wallet)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-mono text-amber-400 hover:underline inline-flex items-center gap-1"
                        >
                          {truncAddr(result.funding.source_wallet)}
                          <ExternalLink size={10} />
                        </a>
                        {result.funding.from_cex && result.funding.cex_name && (
                          <span className="ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-bold rounded-full">
                            {result.funding.cex_name}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-600">Unknown</div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Other Deployers Funded</div>
                    <div className={`text-lg font-semibold ${
                      result.funding.other_deployers_funded > 3 ? 'text-red-400'
                        : result.funding.other_deployers_funded > 0 ? 'text-yellow-400'
                        : 'text-green-400'
                    }`}>
                      {result.funding.other_deployers_funded}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Cluster Tokens</div>
                    <div className="text-lg font-semibold text-slate-300">
                      {result.funding.cluster_total_tokens || 0}
                      {result.funding.cluster_total_dead > 0 && (
                        <span className="text-xs text-red-400 ml-2">
                          ({result.funding.cluster_total_dead} dead)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Verdict */}
              <div className={`p-6 rounded-xl border ${
                result.verdict === 'CLEAN' ? 'bg-green-500/5 border-green-500/20'
                  : result.verdict === 'SUSPICIOUS' ? 'bg-yellow-500/5 border-yellow-500/20'
                  : 'bg-red-500/5 border-red-500/20'
              }`}>
                <div className="flex items-start gap-3">
                  {result.verdict === 'CLEAN'
                    ? <CheckCircle2 size={24} className="text-green-400 flex-shrink-0 mt-0.5" />
                    : result.verdict === 'SUSPICIOUS'
                    ? <AlertTriangle size={24} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                    : <Skull size={24} className="text-red-400 flex-shrink-0 mt-0.5" />}
                  <div>
                    <h3 className={`font-semibold mb-1 ${
                      result.verdict === 'CLEAN' ? 'text-green-400'
                        : result.verdict === 'SUSPICIOUS' ? 'text-yellow-400'
                        : 'text-red-400'
                    }`}>
                      {result.verdict === 'CLEAN' ? 'Clean Deployer'
                        : result.verdict === 'SUSPICIOUS' ? 'Suspicious Deployer'
                        : 'Serial Rugger Detected'}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {result.verdict === 'CLEAN'
                        ? `This deployer has a ${((result.deployer.death_rate ?? result.deployer.rug_rate) * 100).toFixed(1)}% death rate with a trust score of ${result.deployer.reputation_score}/100. Relatively safe.`
                        : result.verdict === 'SUSPICIOUS'
                        ? `This deployer has a ${((result.deployer.death_rate ?? result.deployer.rug_rate) * 100).toFixed(1)}% death rate. Exercise caution before investing.`
                        : `This deployer has killed ${result.deployer.tokens_dead} out of ${result.deployer.tokens_created} tokens (${((result.deployer.death_rate ?? result.deployer.rug_rate) * 100).toFixed(1)}% death rate). Do NOT invest.`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Evidence & Confidence */}
              <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Eye size={14} />
                  Evidence & Confidence
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-4">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Tokens Verified</div>
                    <div className="text-lg font-semibold text-green-400">
                      {result.confidence?.tokens_verified ?? result.deployer.tokens.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Tokens Unverified</div>
                    <div className={`text-lg font-semibold ${(result.confidence?.tokens_unverified || result.deployer.tokens_unverified || 0) > 0 ? 'text-yellow-400' : 'text-slate-400'}`}>
                      {result.confidence?.tokens_unverified ?? result.deployer.tokens_unverified ?? 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Detection Method</div>
                    <div className="text-sm text-slate-300">
                      {result.confidence?.deployer_method === 'enhanced_api' ? 'Enhanced API'
                        : result.confidence?.deployer_method === 'rpc_fallback' ? 'RPC Fallback'
                        : 'Enhanced API'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Cluster Checked</div>
                    <div className="text-sm text-slate-300">
                      {result.confidence?.cluster_checked === true ? 'Yes'
                        : result.confidence?.cluster_checked === false ? 'No'
                        : result.funding?.source_wallet ? 'Yes' : 'No'}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 pt-3 border-t border-slate-700">
                  <a
                    href={result.evidence?.deployer_url || solscanUrl(result.deployer.wallet)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-amber-400 hover:underline inline-flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded"
                  >
                    Deployer on Solscan <ExternalLink size={10} />
                  </a>
                  {(result.evidence?.funding_source_url || result.funding?.source_wallet) && (
                    <a
                      href={result.evidence?.funding_source_url || solscanUrl(result.funding.source_wallet)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-amber-400 hover:underline inline-flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded"
                    >
                      Funder on Solscan <ExternalLink size={10} />
                    </a>
                  )}
                  {result.evidence?.creation_tx_url && (
                    <a
                      href={result.evidence.creation_tx_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-amber-400 hover:underline inline-flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded"
                    >
                      Creation Tx <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>

              <div className="text-center text-xs text-slate-600">
                Scanned at {new Date(result.scanned_at).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
