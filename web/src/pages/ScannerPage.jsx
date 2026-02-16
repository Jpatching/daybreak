import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Search,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Shield,
  GitBranch,
  Layers,
  Terminal,
  FileText,
  Lock,
  Loader2,
  Download,
  Menu,
  X,
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

// ---------- Token logos ----------

const TOKEN_LOGOS = {
  ONDO: 'https://tokens.1inch.io/0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3.png',
  AAVE: 'https://tokens.1inch.io/0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9.png',
  stETH: 'https://tokens.1inch.io/0xae7ab96520de3a18e5e111b5eaab095312d7fe84.png',
};

const TOKEN_COLORS = {
  ONDO: '#162c5e',
  AAVE: '#b6509e',
  stETH: '#00a3ff',
};

function TokenLogo({ symbol, size = 36 }) {
  const [failed, setFailed] = useState(false);
  const url = TOKEN_LOGOS[symbol];
  const bg = TOKEN_COLORS[symbol] || '#334155';

  if (!url || failed) {
    return (
      <div
        className="rounded-full flex items-center justify-center font-bold text-white"
        style={{ width: size, height: size, fontSize: size * 0.38, backgroundColor: bg }}
      >
        {symbol?.[0]}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={symbol}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
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

// ---------- Mock data ----------

const MOCK_RESULTS = {
  '0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3': {
    name: 'Ondo Finance', symbol: 'ONDO', chain: 'Ethereum',
    address: '0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3',
    decimals: 18, totalSupply: '10,000,000,000', riskScore: 36, riskRating: 'Low',
    nttCompatible: true, nttMode: 'Locking',
    bytecode: { sizeKb: 8.2, complexity: 'Moderate', isProxy: false, hasSelfDestruct: false, hasDelegateCall: false },
    capabilities: [
      { name: 'Mintable', detected: true, severity: 'info' },
      { name: 'Burnable', detected: false, severity: 'info' },
      { name: 'Pausable', detected: false, severity: 'warning' },
      { name: 'Blacklist', detected: false, severity: 'warning' },
      { name: 'Permit (EIP-2612)', detected: true, severity: 'info' },
      { name: 'Fee-on-Transfer', detected: false, severity: 'error' },
      { name: 'Rebasing', detected: false, severity: 'error' },
    ],
    riskBreakdown: [
      { dim: 'Decimal Handling', score: 20, max: 20 },
      { dim: 'Token Features', score: 0, max: 25 },
      { dim: 'Bytecode Complexity', score: 8, max: 20 },
      { dim: 'Holder Concentration', score: 5, max: 15 },
      { dim: 'Bridge Status', score: 0, max: 20 },
    ],
    issues: [
      { severity: 'WARNING', msg: 'Decimal trimming: 18 \u2192 8. Max dust per tx: < 0.00000001 tokens.' },
      { severity: 'INFO', msg: 'Mintable token. Locking mode recommended (mint authority stays on source chain).' },
    ],
    verdict: 'ONDO is a strong candidate for NTT migration via Sunrise. Recommended mode: Locking.',
  },
  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': {
    name: 'Aave', symbol: 'AAVE', chain: 'Ethereum',
    address: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
    decimals: 18, totalSupply: '16,000,000', riskScore: 42, riskRating: 'Medium',
    nttCompatible: true, nttMode: 'Locking',
    bytecode: { sizeKb: 14.8, complexity: 'Moderate', isProxy: true, hasSelfDestruct: false, hasDelegateCall: true },
    capabilities: [
      { name: 'Mintable', detected: false, severity: 'info' },
      { name: 'Burnable', detected: false, severity: 'info' },
      { name: 'Pausable', detected: false, severity: 'warning' },
      { name: 'Blacklist', detected: false, severity: 'warning' },
      { name: 'Permit (EIP-2612)', detected: true, severity: 'info' },
      { name: 'Fee-on-Transfer', detected: false, severity: 'error' },
      { name: 'Rebasing', detected: false, severity: 'error' },
    ],
    riskBreakdown: [
      { dim: 'Decimal Handling', score: 20, max: 20 },
      { dim: 'Token Features', score: 0, max: 25 },
      { dim: 'Bytecode Complexity', score: 13, max: 20 },
      { dim: 'Holder Concentration', score: 5, max: 15 },
      { dim: 'Bridge Status', score: 5, max: 20 },
    ],
    issues: [
      { severity: 'WARNING', msg: 'Decimal trimming required: 18 \u2192 8 decimals.' },
      { severity: 'WARNING', msg: 'Proxy contract detected. Monitor for implementation upgrades.' },
      { severity: 'INFO', msg: 'Wormhole Portal attestation exists. Consider NTT upgrade.' },
    ],
    verdict: 'AAVE is compatible with NTT migration. Proxy requires monitoring. Recommended mode: Locking.',
  },
  '0xae7ab96520de3a18e5e111b5eaab095312d7fe84': {
    name: 'Lido Staked ETH', symbol: 'stETH', chain: 'Ethereum',
    address: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
    decimals: 18, totalSupply: '9,800,000', riskScore: 89, riskRating: 'High',
    nttCompatible: false, nttMode: 'N/A',
    bytecode: { sizeKb: 22.4, complexity: 'Complex', isProxy: true, hasSelfDestruct: false, hasDelegateCall: true },
    capabilities: [
      { name: 'Mintable', detected: true, severity: 'info' },
      { name: 'Burnable', detected: true, severity: 'info' },
      { name: 'Pausable', detected: true, severity: 'warning' },
      { name: 'Blacklist', detected: false, severity: 'warning' },
      { name: 'Permit (EIP-2612)', detected: true, severity: 'info' },
      { name: 'Fee-on-Transfer', detected: false, severity: 'error' },
      { name: 'Rebasing', detected: true, severity: 'error' },
    ],
    riskBreakdown: [
      { dim: 'Decimal Handling', score: 20, max: 20 },
      { dim: 'Token Features', score: 25, max: 25 },
      { dim: 'Bytecode Complexity', score: 20, max: 20 },
      { dim: 'Holder Concentration', score: 10, max: 15 },
      { dim: 'Bridge Status', score: 15, max: 20 },
    ],
    issues: [
      { severity: 'ERROR', msg: 'Rebasing token detected. Locked tokens will desync from minted supply. NTT incompatible.' },
      { severity: 'ERROR', msg: 'Use wstETH (wrapped, non-rebasing) instead.' },
      { severity: 'WARNING', msg: 'Pausable contract \u2014 bridge operations could be frozen.' },
      { severity: 'WARNING', msg: 'High holder concentration: top 10 hold ~72%.' },
    ],
    verdict: 'stETH is NOT compatible with NTT migration due to rebasing. Use wstETH instead.',
  },
};

const SYMBOL_MAP = {
  ondo: '0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3',
  aave: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
  steth: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
};

function lookupResult(query) {
  if (!query) return null;
  const q = query.toLowerCase().trim();
  if (MOCK_RESULTS[q]) return MOCK_RESULTS[q];
  if (SYMBOL_MAP[q]) return MOCK_RESULTS[SYMBOL_MAP[q]];
  for (const [addr, result] of Object.entries(MOCK_RESULTS)) {
    if (addr.startsWith(q) || result.symbol.toLowerCase() === q) return result;
  }
  return null;
}

function RiskGauge({ score }) {
  const c = 2 * Math.PI * 45;
  const offset = c - (score / 100) * c;
  const color = score <= 33 ? '#22c55e' : score <= 66 ? '#eab308' : '#ef4444';
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

// ---------- Download report ----------

function generateReport(result) {
  const lines = [
    `# Daybreak Migration Report`,
    ``,
    `## ${result.name} (${result.symbol})`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| Chain | ${result.chain} |`,
    `| Address | \`${result.address}\` |`,
    `| Decimals | ${result.decimals} |`,
    `| Total Supply | ${result.totalSupply} |`,
    `| Risk Score | ${result.riskScore}/100 (${result.riskRating}) |`,
    `| NTT Compatible | ${result.nttCompatible ? 'Yes' : 'No'} |`,
    `| NTT Mode | ${result.nttMode} |`,
    ``,
    `## Risk Breakdown`,
    ``,
    `| Dimension | Score | Max |`,
    `|-----------|-------|-----|`,
    ...result.riskBreakdown.map(d => `| ${d.dim} | ${d.score} | ${d.max} |`),
    ``,
    `## Capabilities`,
    ``,
    `| Capability | Detected | Severity |`,
    `|-----------|----------|----------|`,
    ...result.capabilities.map(c => `| ${c.name} | ${c.detected ? 'Yes' : 'No'} | ${c.severity} |`),
    ``,
    `## Bytecode Analysis`,
    ``,
    `- **Size:** ${result.bytecode.sizeKb} KB`,
    `- **Complexity:** ${result.bytecode.complexity}`,
    `- **Proxy:** ${result.bytecode.isProxy ? 'Yes' : 'No'}`,
    `- **Selfdestruct:** ${result.bytecode.hasSelfDestruct ? 'Yes' : 'No'}`,
    `- **Delegatecall:** ${result.bytecode.hasDelegateCall ? 'Yes' : 'No'}`,
    ``,
    `## Issues & Recommendations`,
    ``,
    ...result.issues.map(i => `- **[${i.severity}]** ${i.msg}`),
    ``,
    `## Verdict`,
    ``,
    result.verdict,
    ``,
    `---`,
    ``,
    `*Generated by [Daybreak](https://github.com/Jpatching/daybreak) | Built for Wormhole Sunrise*`,
  ];
  return lines.join('\n');
}

function downloadReport(result) {
  const md = generateReport(result);
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `daybreak-${result.symbol.toLowerCase()}-report.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- Main ----------

export default function ScannerPage() {
  const { address: urlAddress } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(urlAddress || '');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [chain, setChain] = useState('Ethereum');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const chains = ['Ethereum', 'Polygon', 'Arbitrum', 'BSC', 'Base', 'Optimism', 'Avalanche'];

  useEffect(() => {
    if (urlAddress) {
      setScanning(true);
      setResult(null);
      setTimeout(() => {
        setResult(lookupResult(urlAddress));
        setScanning(false);
      }, 1200);
    }
  }, [urlAddress]);

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
              <a href="/" className="text-slate-300 hover:text-white transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>
                Home
              </a>
              <a
                href="https://github.com/Jpatching/daybreak"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-300 hover:text-white transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                GitHub
              </a>
            </div>
          </div>
        )}
      </nav>

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-2" style={gradientTextStyle}>
            Token Migration Scanner
          </h1>
          <p className="text-slate-400 text-center mb-8">
            Paste an ERC-20 address or token symbol to analyze migration readiness.
          </p>

          {/* Search */}
          <form onSubmit={handleSubmit} className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="0x... or token symbol (ondo, aave, steth)"
                className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 font-mono text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={scanning}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {scanning ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              Scan
            </button>
          </form>

          {/* Chain pills */}
          <div className="flex gap-2 mb-10 flex-wrap">
            {chains.map((c) => (
              <button
                key={c}
                onClick={() => setChain(c)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  chain === c ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Demo tokens */}
          {!result && !scanning && (
            <div className="text-center py-16">
              <p className="text-slate-500 mb-6">Try these example tokens:</p>
              <div className="flex flex-wrap gap-3 justify-center">
                {[
                  { sym: 'ONDO', label: 'Low Risk', cls: 'text-green-400' },
                  { sym: 'AAVE', label: 'Medium Risk', cls: 'text-yellow-400' },
                  { sym: 'stETH', label: 'High Risk (Rebasing)', cls: 'text-red-400' },
                ].map((t) => (
                  <button
                    key={t.sym}
                    onClick={() => { setQuery(t.sym); navigate(`/scan/${t.sym}`); }}
                    className="px-5 py-3 bg-slate-800/50 border border-slate-700 rounded-xl hover:border-amber-500/50 transition-colors text-left flex items-center gap-3"
                  >
                    <TokenLogo symbol={t.sym} size={32} />
                    <div>
                      <div className="font-semibold text-white">{t.sym}</div>
                      <div className={`text-xs ${t.cls}`}>{t.label}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {scanning && (
            <div className="text-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-amber-400 mx-auto mb-4" />
              <p className="text-slate-400">Analyzing bytecode, capabilities, and bridge status...</p>
            </div>
          )}

          {/* Not found */}
          {!scanning && urlAddress && !result && (
            <div className="text-center py-16">
              <XCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 mb-2">Token not found in demo database</p>
              <p className="text-xs text-slate-600">Demo supports: ONDO, AAVE, stETH. Install CLI for full scanning:</p>
              <code className="text-xs text-amber-400 mt-2 block font-mono">cargo install daybreak</code>
            </div>
          )}

          {/* Results */}
          {result && !scanning && (
            <div className="space-y-6">
              {/* Header card */}
              <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <TokenLogo symbol={result.symbol} size={36} />
                      <h2 className="text-2xl font-bold text-white">{result.name}</h2>
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full font-medium">{result.symbol}</span>
                      <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded-full">{result.chain}</span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mb-4">{result.address}</p>
                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Decimals</div>
                        <div className="text-lg font-semibold text-white">{result.decimals}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Supply</div>
                        <div className="text-lg font-semibold text-white">{result.totalSupply}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">NTT Mode</div>
                        <div className="text-lg font-semibold text-amber-400">{result.nttMode}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <RiskGauge score={result.riskScore} />
                    <span className={`mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                      result.riskRating === 'Low' ? 'bg-green-500/20 text-green-400'
                        : result.riskRating === 'Medium' ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {result.riskRating} Risk
                    </span>
                  </div>
                </div>
              </div>

              {/* Two columns */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Capabilities */}
                <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                  <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-4">Capabilities</h3>
                  <div className="space-y-3">
                    {result.capabilities.map((cap) => (
                      <div key={cap.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {cap.detected ? (
                            cap.severity === 'error' ? <XCircle size={16} className="text-red-400" />
                              : cap.severity === 'warning' ? <AlertTriangle size={16} className="text-yellow-400" />
                              : <CheckCircle2 size={16} className="text-green-400" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-slate-600" />
                          )}
                          <span className={`text-sm ${cap.detected ? 'text-white' : 'text-slate-600'}`}>{cap.name}</span>
                        </div>
                        <span className={`text-xs ${cap.detected ? 'text-white' : 'text-slate-700'}`}>
                          {cap.detected ? 'Yes' : 'No'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Risk breakdown */}
                <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                  <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-4">Risk Breakdown</h3>
                  <div className="space-y-4">
                    {result.riskBreakdown.map((d) => (
                      <div key={d.dim}>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-slate-300">{d.dim}</span>
                          <span className="text-xs text-slate-500 font-mono">{d.score}/{d.max}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ${
                              d.max === 0 ? 'bg-slate-600' : d.score / d.max <= 0.33 ? 'bg-green-500' : d.score / d.max <= 0.66 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: d.max === 0 ? '0%' : `${(d.score / d.max) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bytecode */}
              <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-4">Bytecode Analysis</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { label: 'Size', value: `${result.bytecode.sizeKb} KB` },
                    { label: 'Complexity', value: result.bytecode.complexity },
                    { label: 'Proxy', value: result.bytecode.isProxy ? 'Yes' : 'No', warn: result.bytecode.isProxy },
                    { label: 'Selfdestruct', value: result.bytecode.hasSelfDestruct ? 'Yes' : 'No', warn: result.bytecode.hasSelfDestruct },
                    { label: 'Delegatecall', value: result.bytecode.hasDelegateCall ? 'Yes' : 'No', warn: result.bytecode.hasDelegateCall },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="text-xs text-slate-500 mb-1">{item.label}</div>
                      <div className={`font-semibold ${item.warn ? 'text-yellow-400' : 'text-white'}`}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Issues */}
              <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-4">Issues & Recommendations</h3>
                <div className="space-y-3">
                  {result.issues.map((issue, i) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${
                      issue.severity === 'ERROR' ? 'bg-red-500/5 border-red-500/20'
                        : issue.severity === 'WARNING' ? 'bg-yellow-500/5 border-yellow-500/20'
                        : 'bg-blue-500/5 border-blue-500/20'
                    }`}>
                      {issue.severity === 'ERROR' ? <XCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                        : issue.severity === 'WARNING' ? <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                        : <Info size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />}
                      <p className="text-sm text-slate-300">{issue.msg}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Verdict */}
              <div className={`p-6 rounded-xl border ${
                result.nttCompatible ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'
              }`}>
                <div className="flex items-start gap-3">
                  {result.nttCompatible
                    ? <CheckCircle2 size={24} className="text-green-400 flex-shrink-0 mt-0.5" />
                    : <XCircle size={24} className="text-red-400 flex-shrink-0 mt-0.5" />}
                  <div>
                    <h3 className={`font-semibold mb-1 ${result.nttCompatible ? 'text-green-400' : 'text-red-400'}`}>
                      {result.nttCompatible ? 'NTT Migration Compatible' : 'NTT Migration Incompatible'}
                    </h3>
                    <p className="text-sm text-slate-400">{result.verdict}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => downloadReport(result)}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  Download Report
                </button>
                <button
                  onClick={() => {
                    const cmds = [
                      `# Install Daybreak`,
                      `cargo install --path .`,
                      ``,
                      `# Scan this token`,
                      `daybreak scan ${result.address}`,
                      ``,
                      `# Generate full report`,
                      `daybreak report ${result.address} --output ./report`,
                      result.nttCompatible ? `\n# Migrate (requires Solana keypair)\ndaybreak migrate ${result.address} --keypair ~/wallet.json` : `# Not eligible for migration`,
                    ].join('\n');
                    navigator.clipboard.writeText(cmds);
                  }}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Terminal size={18} />
                  Copy CLI Commands
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
