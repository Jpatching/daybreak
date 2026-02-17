import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import useAuth from '../hooks/useAuth';
import { scanToken } from '../api';
import {
  Search,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  Loader2,
  Menu,
  X,
  Wallet,
  Skull,
  Users,
  Eye,
  TrendingUp,
  ExternalLink,
} from 'lucide-react';

// ---------- Branding ----------

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
  // FLIPPED: high score = green (good), low score = red (rugger)
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

// ---------- Address truncation ----------

function truncAddr(addr) {
  if (!addr) return '...';
  return addr.slice(0, 4) + '...' + addr.slice(-4);
}

function solscanUrl(addr) {
  return `https://solscan.io/account/${addr}`;
}

// ---------- Error messages ----------

const ERROR_MESSAGES = {
  AUTH_REQUIRED: 'Please connect your wallet and sign in to scan.',
  RATE_LIMITED: 'Rate limit exceeded. Max 10 scans per hour. Try again later.',
  NOT_FOUND: 'Token not found. Make sure this is a valid Solana token address.',
  SERVICE_UNAVAILABLE: 'Backend is temporarily unavailable. Try again in a moment.',
};

// ---------- Main ----------

export default function ScannerPage() {
  const { address: urlAddress } = useParams();
  const navigate = useNavigate();
  const { connected } = useWallet();
  const { isAuthenticated, token, login, loading: authLoading, error: authError } = useAuth();

  const [query, setQuery] = useState(urlAddress || '');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auto-login when wallet connects
  useEffect(() => {
    if (connected && !isAuthenticated && !authLoading) {
      login();
    }
  }, [connected, isAuthenticated, authLoading, login]);

  // Scan when URL address changes
  useEffect(() => {
    if (urlAddress && isAuthenticated && token) {
      doScan(urlAddress);
    }
  }, [urlAddress, isAuthenticated, token]);

  async function doScan(address) {
    setScanning(true);
    setResult(null);
    setError(null);
    try {
      const data = await scanToken(address, token);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) navigate(`/scan/${query.trim()}`);
  };

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
            <WalletMultiButton className="!bg-amber-500 !text-slate-900 !font-semibold !rounded-lg !text-sm !h-9 !px-4 hover:!bg-amber-400" />
            <a
              href="https://github.com/Jpatching/daybreak"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition-colors text-sm"
            >
              GitHub
            </a>
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
              <div className="py-2">
                <WalletMultiButton className="!bg-amber-500 !text-slate-900 !font-semibold !rounded-lg !text-sm !h-9 !px-4" />
              </div>
              <a href="https://github.com/Jpatching/daybreak" target="_blank" rel="noopener noreferrer"
                className="text-slate-300 hover:text-white transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>
                GitHub
              </a>
            </div>
          </div>
        )}
      </nav>

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-2" style={gradientTextStyle}>
            Deployer Reputation Scanner
          </h1>
          <p className="text-slate-400 text-center mb-8">
            Paste a Solana token address to analyze the deployer's reputation.
          </p>

          {/* Search */}
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
              disabled={scanning || !isAuthenticated}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {scanning ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              Scan
            </button>
          </form>

          {/* Auth gate */}
          {!connected && (
            <div className="text-center py-16">
              <Wallet className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 mb-4">Connect your wallet to start scanning</p>
              <p className="text-xs text-slate-600 mb-6">We verify wallet ownership via message signing. No transactions, no funds at risk.</p>
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

          {/* Ready to scan (authenticated, no scan yet) */}
          {isAuthenticated && !urlAddress && !scanning && !result && (
            <div className="text-center py-16">
              <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Paste a Solana token address above and click Scan</p>
              <p className="text-xs text-slate-600 mt-2">Works with any Pump.fun token</p>
            </div>
          )}

          {/* Loading */}
          {scanning && (
            <div className="text-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-amber-400 mx-auto mb-4" />
              <p className="text-slate-400">Scanning deployer history...</p>
              <p className="text-xs text-slate-600 mt-2">This may take 5-15 seconds</p>
            </div>
          )}

          {/* Error states */}
          {error && !scanning && (
            <div className="text-center py-16">
              <XCircle className="w-12 h-12 text-red-500/50 mx-auto mb-4" />
              <p className="text-slate-400 mb-2">{ERROR_MESSAGES[error] || `Error: ${error}`}</p>
              {error === 'AUTH_REQUIRED' && (
                <WalletMultiButton className="!bg-amber-500 !text-slate-900 !font-semibold !rounded-lg !text-sm !h-10 !px-6 hover:!bg-amber-400 mx-auto mt-4" />
              )}
            </div>
          )}

          {/* Results */}
          {result && !scanning && (
            <div className="space-y-6">
              {/* Token card */}
              <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-2xl font-bold text-white">
                        {result.token.name} ({result.token.symbol})
                      </h2>
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Wallet</div>
                    <a
                      href={solscanUrl(result.deployer.wallet)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono text-amber-400 hover:underline inline-flex items-center gap-1"
                    >
                      {truncAddr(result.deployer.wallet)}
                      <ExternalLink size={10} />
                    </a>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Tokens Created</div>
                    <div className="text-lg font-semibold text-white">{result.deployer.tokens_created}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Tokens Dead</div>
                    <div className={`text-lg font-semibold ${result.deployer.tokens_dead > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {result.deployer.tokens_dead}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Rug Rate</div>
                    <div className={`text-lg font-semibold ${
                      result.deployer.rug_rate > 0.7 ? 'text-red-400'
                        : result.deployer.rug_rate > 0.3 ? 'text-yellow-400'
                        : 'text-green-400'
                    }`}>
                      {(result.deployer.rug_rate * 100).toFixed(1)}%
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

              {/* Token list */}
              {result.deployer.tokens && result.deployer.tokens.length > 0 && (
                <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                  <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <TrendingUp size={14} />
                    Deployer's Tokens ({result.deployer.tokens.length})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-700">
                          <th className="text-left pb-3 pr-4">Token</th>
                          <th className="text-left pb-3 pr-4">Symbol</th>
                          <th className="text-left pb-3 pr-4">Status</th>
                          <th className="text-right pb-3">Liquidity</th>
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
                            <td className="py-2 text-right font-mono text-xs text-slate-400">
                              ${t.liquidity?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}
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
                      <a
                        href={solscanUrl(result.funding.source_wallet)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-mono text-amber-400 hover:underline inline-flex items-center gap-1"
                      >
                        {truncAddr(result.funding.source_wallet)}
                        <ExternalLink size={10} />
                      </a>
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
                        ? `This deployer has a ${(result.deployer.rug_rate * 100).toFixed(1)}% rug rate with a reputation score of ${result.deployer.reputation_score}/100. Relatively safe.`
                        : result.verdict === 'SUSPICIOUS'
                        ? `This deployer has a ${(result.deployer.rug_rate * 100).toFixed(1)}% rug rate. Exercise caution before investing.`
                        : `This deployer has rugged ${result.deployer.tokens_dead} out of ${result.deployer.tokens_created} tokens (${(result.deployer.rug_rate * 100).toFixed(1)}%). Do NOT invest.`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Scanned at */}
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
