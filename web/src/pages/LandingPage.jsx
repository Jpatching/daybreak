import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Search,
  GitBranch,
  Layers,
  Globe,
  Lock,
  Zap,
  ChevronLeft,
  ChevronRight,
  Terminal,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BarChart2,
  Activity,
  Target,
  Eye,
  Settings,
  Bot,
  ArrowRight,
  Github,
  Code,
  Database,
  Cpu,
  Rocket,
  Server,
  Scale,
  Menu,
  X,
} from 'lucide-react';
import {
  SiEthereum,
  SiPolygon,
  SiSolana,
  SiOptimism,
  SiCoinbase,
} from '@icons-pack/react-simple-icons';

// ---------- Branding SVG components ----------

function DaybreakLogo({ size = 28 }) {
  return (
    <img
      src="/daybreak-logo.png"
      alt="Daybreak"
      style={{ width: size * 1.6, height: size }}
      className="object-contain"
    />
  );
}

function WormholeIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <rect width="40" height="40" rx="20" fill="#0d1117" />
      <circle cx="20" cy="20" r="14" fill="none" stroke="white" strokeWidth="1.5" opacity="0.25" />
      <circle cx="20" cy="20" r="10" fill="none" stroke="white" strokeWidth="1.5" opacity="0.45" />
      <circle cx="20" cy="20" r="6" fill="none" stroke="white" strokeWidth="1.5" opacity="0.7" />
      <circle cx="20" cy="20" r="2.5" fill="white" />
    </svg>
  );
}

function SunriseIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <rect width="40" height="40" rx="20" fill="#1a0800" />
      <defs>
        <linearGradient id="sun-g" x1="20" y1="14" x2="20" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbbf24" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="24" r="8" fill="url(#sun-g)" />
      <rect x="0" y="24" width="40" height="16" fill="#1a0800" />
      <line x1="20" y1="10" x2="20" y2="5" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="14" x2="9" y2="10" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
      <line x1="28" y1="14" x2="31" y2="10" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
      <line x1="6" y1="24" x2="34" y2="24" stroke="#92400e" strokeWidth="1" />
    </svg>
  );
}

function ArbitrumIcon({ size = 28, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className}>
      <rect width="40" height="40" rx="20" fill="#213147" />
      <path d="M20.7 11L27.5 22.5L24.2 24.5L20.7 17.5L17.2 24.5L13.9 22.5L20.7 11Z" fill="#12AAFF" />
      <path d="M20.7 17.5L24.2 24.5L20.7 30L17.2 24.5L20.7 17.5Z" fill="white" />
    </svg>
  );
}

function AvalancheIcon({ size = 28, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className}>
      <rect width="40" height="40" rx="20" fill="#E84142" />
      <path d="M20 10L30 28H10L20 10Z" fill="white" />
      <path d="M20 17L25 27H15L20 17Z" fill="#E84142" />
    </svg>
  );
}

function BnbIcon({ size = 28, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className}>
      <rect width="40" height="40" rx="20" fill="#F3BA2F" />
      <path d="M20 8L24 12L21.5 14.5L20 13L18.5 14.5L16 12L20 8Z" fill="white" />
      <path d="M27 15L31 19L27 23L23 19L27 15Z" fill="white" transform="scale(0.55) translate(17,13)" />
      <path d="M13 15L17 19L13 23L9 19L13 15Z" fill="white" transform="scale(0.55) translate(17,13)" />
      <path d="M20 18L24 22L20 26L16 22L20 18Z" fill="white" />
      <path d="M20 32L16 28L18.5 25.5L20 27L21.5 25.5L24 28L20 32Z" fill="white" />
    </svg>
  );
}

// ---------- Token logos ----------

const TOKEN_LOGOS = {
  ONDO: 'https://tokens.1inch.io/0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3.png',
  UNI: 'https://tokens.1inch.io/0x1f9840a85d5af5bf1d1762f925bdaddc4201f984.png',
  LINK: 'https://tokens.1inch.io/0x514910771af9ca656af840dff83e8264ecf986ca.png',
  ARB: 'https://tokens.1inch.io/0xb50721bcf8d664c30412cfbc6cf7a15145234ad1.png',
  AAVE: 'https://tokens.1inch.io/0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9.png',
  MKR: 'https://tokens.1inch.io/0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2.png',
  PEPE: 'https://tokens.1inch.io/0x6982508145454ce325ddbe47a25d4ec3d2311933.png',
  stETH: 'https://tokens.1inch.io/0xae7ab96520de3a18e5e111b5eaab095312d7fe84.png',
};

const TOKEN_COLORS = {
  ONDO: '#162c5e',
  UNI: '#ff007a',
  LINK: '#2a5ada',
  ARB: '#28a0f0',
  AAVE: '#b6509e',
  MKR: '#1aab9b',
  PEPE: '#3cbe00',
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

// ---------- Gradient text styles ----------

const gradientTextStyle = {
  background: 'linear-gradient(180deg, #ffffff 0%, #f59e0b 50%, #d97706 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  filter: 'drop-shadow(0 0 15px rgba(245, 158, 11, 0.4))',
};

const gradientTextStyleHero = {
  background: 'linear-gradient(180deg, #ffffff 0%, #f59e0b 50%, #d97706 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  filter: 'drop-shadow(0 0 20px rgba(245, 158, 11, 0.5))',
};

// ---------- Data ----------

const features = [
  { color: 'amber', title: 'Risk Scoring (0-100)', description: 'Composite score across 5 dimensions: decimals, token features, bytecode complexity, holder concentration, bridge status.' },
  { color: 'green', title: 'NTT Mode Analysis', description: 'Auto-recommends Locking vs Burning mode. Detects mint, burn, pause, blacklist, rebasing, fee-on-transfer.' },
  { color: 'purple', title: 'Bytecode Inspection', description: 'Static analysis of EVM bytecode. Proxy detection (EIP-1167, EIP-1967), selfdestruct, delegatecall, complexity rating.' },
  { color: 'blue', title: 'Bridge Detection', description: 'Live WormholeScan API queries. Distinguishes Portal (wrapped), NTT (native), and natively-issued tokens.' },
  { color: 'orange', title: 'SPL Deployment', description: 'Deploy SPL token on Solana with Metaplex metadata. Handles decimal trimming (18\u21928), mint authority transfer.' },
  { color: 'red', title: 'End-to-End Migration', description: 'Scan \u2192 Deploy SPL \u2192 Write NTT config \u2192 Orchestrate NTT CLI \u2192 Verify. Full pipeline in one command.' },
  { color: 'emerald', title: 'Multi-Chain Support', description: 'Ethereum, Polygon, BSC, Arbitrum, Base, Optimism, Avalanche. Auto-detects chain-specific explorers.' },
  { color: 'cyan', title: 'Rate Limit Intelligence', description: 'Calculates NTT rate limits from 24h transfer volume and supply. Conservative defaults with per-tx caps.' },
  { color: 'pink', title: 'Holder Concentration', description: 'Etherscan top-10 holder analysis. Whale concentration scoring, governance token detection.' },
  { color: 'yellow', title: 'Report Generation', description: 'Markdown + deployment.json + ntt-commands.sh. Ready-to-run migration scripts with cost estimates.' },
  { color: 'purple', title: 'Token Discovery', description: 'Dynamic CoinGecko API integration. Find migration-ready tokens by market cap. Curated fallback for 55+ tokens.' },
];

const stats = [
  { value: '7', label: 'EVM Chains', icon: Globe },
  { value: '8', label: 'Commands', icon: Terminal },
  { value: '60+', label: 'Tests', icon: Shield },
  { value: '0-100', label: 'Risk Score', icon: BarChart2 },
  { icon: Search, label: 'Bytecode Analysis' },
  { icon: Github, label: 'Open Source' },
  { icon: GitBranch, label: 'NTT Modes' },
  { icon: Scale, label: 'Rate Limits' },
  { icon: Eye, label: 'Bridge Detection' },
  { icon: Layers, label: 'SPL Deploy' },
  { icon: Shield, label: 'Risk Scoring' },
  { icon: FileText, label: 'Report Gen' },
  { icon: Database, label: 'Holder Analysis' },
  { icon: Rocket, label: 'Sunrise Ready' },
];

const codeExample = `# Install
cargo install --path .

# Scan a token
daybreak scan 0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3

# Generate migration report
daybreak report 0xfaba...69be3 --output ./report

# Full end-to-end migration
daybreak migrate 0xfaba...69be3 --keypair ~/sol-wallet.json`;

const advancedFeatures = [
  { icon: Shield, title: 'Risk Scoring', desc: 'Composite 0-100 across decimals, features, bytecode, holders, bridges', color: 'amber' },
  { icon: GitBranch, title: 'NTT Compatibility', desc: 'Locking vs Burning mode, decimal trimming, rebasing detection', color: 'green' },
  { icon: Search, title: 'Bytecode Analysis', desc: 'Proxy detection, selfdestruct, delegatecall, complexity rating', color: 'purple' },
  { icon: Eye, title: 'Bridge Detection', desc: 'WormholeScan API, Portal/NTT/Native token classification', color: 'blue' },
  { icon: Layers, title: 'SPL Deployment', desc: 'Mint creation, Metaplex metadata, authority transfer', color: 'orange' },
  { icon: Rocket, title: 'Migration Pipeline', desc: 'Scan \u2192 Deploy \u2192 Config \u2192 NTT CLI \u2192 Verify in one command', color: 'red' },
  { icon: BarChart2, title: 'Rate Limits', desc: 'Volume-based NTT rate limit calculation with supply floors', color: 'cyan' },
  { icon: Activity, title: 'Holder Analysis', desc: 'Top-10 concentration, whale scoring, governance detection', color: 'yellow' },
  { icon: FileText, title: 'Report Generation', desc: 'Markdown, JSON, deployment.json, ntt-commands.sh', color: 'pink' },
  { icon: Target, title: 'Token Discovery', desc: 'CoinGecko API, curated list of 55+ migration-ready tokens', color: 'emerald' },
  { icon: Terminal, title: 'CLI-First', desc: '8 commands: scan, report, compare, list, deploy, check, migrate, status', color: 'amber' },
  { icon: Settings, title: 'Path Comparison', desc: 'NTT vs Neon EVM vs Native rewrite evaluation', color: 'green' },
  { icon: AlertTriangle, title: 'Fee Detection', desc: 'Fee-on-transfer, rebasing, pausable, blacklist flagging', color: 'red' },
  { icon: Globe, title: '7 EVM Chains', desc: 'Ethereum, Polygon, BSC, Arbitrum, Base, Optimism, Avalanche', color: 'blue' },
  { icon: Lock, title: 'Proxy Analysis', desc: 'EIP-1167 minimal proxy, EIP-1967 transparent proxy, storage slot lookup', color: 'purple' },
  { icon: Database, title: 'Post-Migration', desc: 'SPL token info, WormholeScan transfers, bridge health monitoring', color: 'cyan' },
];

// ---------- Sections ----------

function UserTypeSection() {
  const [userType, setUserType] = useState(null);

  return (
    <section className="py-12 px-6">
      <div className="max-w-2xl mx-auto">
        {!userType ? (
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setUserType('developer')}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors text-sm"
            >
              I'M A DEVELOPER
            </button>
            <button
              onClick={() => setUserType('project')}
              className="px-6 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-semibold rounded-lg transition-colors text-sm border border-amber-500/50"
            >
              I'M A PROJECT TEAM
            </button>
          </div>
        ) : (
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-6">
            <button
              onClick={() => setUserType(null)}
              className="text-slate-400 hover:text-slate-300 text-xs mb-4 transition-colors"
            >
              &larr; Back
            </button>

            {userType === 'developer' ? (
              <div className="space-y-3">
                <h3 className="text-amber-400 font-semibold">Quick Start</h3>
                <code className="block bg-slate-900 p-2 rounded text-amber-300 text-xs overflow-x-auto mb-3">
                  cargo install --path . && daybreak scan 0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3
                </code>
                <p className="text-slate-400 text-xs">Scans ONDO token. Risk score, NTT compatibility, bytecode analysis in seconds. Try <span className="text-amber-300">daybreak list</span> to discover migration-ready tokens.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-amber-400 font-semibold">Full Migration</h3>
                <code className="block bg-slate-900 p-2 rounded text-amber-300 text-xs overflow-x-auto mb-3">
                  daybreak migrate 0xYOUR_TOKEN --keypair ~/wallet.json
                </code>
                <p className="text-slate-400 text-xs">End-to-end: scan &rarr; deploy SPL &rarr; configure NTT &rarr; bridge via Sunrise. Full report at <a href="/scan" className="text-amber-400 hover:underline">/scan</a>.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function MarketsSection() {
  const [marketSlide, setMarketSlide] = useState(0);

  const riskExamples = [
    { name: 'ONDO', statusIcon: CheckCircle2, status: 'Low Risk (36)', detail: 'Locking mode' },
    { name: 'UNI', statusIcon: CheckCircle2, status: 'Low Risk (28)', detail: 'Locking mode' },
    { name: 'LINK', statusIcon: CheckCircle2, status: 'Low Risk (31)', detail: 'Locking mode' },
    { name: 'ARB', statusIcon: CheckCircle2, status: 'Low Risk (25)', detail: 'Locking mode' },
    { name: 'AAVE', statusIcon: AlertTriangle, status: 'Medium (42)', detail: 'Proxy detected' },
    { name: 'MKR', statusIcon: AlertTriangle, status: 'Medium (44)', detail: 'Burning mode' },
    { name: 'PEPE', statusIcon: AlertTriangle, status: 'Medium (55)', detail: 'High concentration' },
    { name: 'stETH', statusIcon: XCircle, status: 'High Risk (89)', detail: 'Rebasing!' },
  ];

  const capabilities = [
    { name: 'Mintable', icon: Zap, status: 'Detected' },
    { name: 'Burnable', icon: Zap, status: 'Detected' },
    { name: 'Pausable', icon: AlertTriangle, status: 'Warning' },
    { name: 'Blacklist', icon: AlertTriangle, status: 'Warning' },
    { name: 'Fee-on-Transfer', icon: XCircle, status: 'Blocker' },
    { name: 'Rebasing', icon: XCircle, status: 'Blocker' },
    { name: 'Permit (EIP-2612)', icon: CheckCircle2, status: 'Info' },
    { name: 'Proxy (EIP-1967)', icon: AlertTriangle, status: 'Monitor' },
  ];

  const chains = [
    { name: 'Ethereum', icon: SiEthereum, status: 'Supported' },
    { name: 'Polygon', icon: SiPolygon, status: 'Supported' },
    { name: 'Arbitrum', icon: ArbitrumIcon, status: 'Supported', isCustom: true },
    { name: 'BSC', icon: BnbIcon, status: 'Supported', isCustom: true },
    { name: 'Base', icon: SiCoinbase, status: 'Supported' },
    { name: 'Optimism', icon: SiOptimism, status: 'Supported' },
    { name: 'Avalanche', icon: AvalancheIcon, status: 'Supported', isCustom: true },
  ];

  const slides = [
    { title: 'Risk Scoring', subtitle: 'Analyze any ERC-20 token for migration readiness', markets: riskExamples, isTokenSlide: true },
    { title: 'Capability Detection', subtitle: 'Deep bytecode inspection for NTT compatibility', markets: capabilities },
    { title: 'Supported Chains', subtitle: 'Scan tokens on any major EVM chain', markets: chains },
  ];

  const currentSlide = slides[marketSlide];

  return (
    <section className="py-20 px-6 bg-slate-800/30">
      <div className="max-w-4xl mx-auto">
        <h2
          className="text-3xl md:text-4xl font-bold text-center mb-2"
          style={gradientTextStyle}
        >
          Analyze any token
        </h2>
        <p className="text-slate-400 text-center mb-4">
          {currentSlide.subtitle}
        </p>

        <div className="flex justify-center gap-2 mb-8">
          {slides.map((slide, idx) => (
            <button
              key={idx}
              onClick={() => setMarketSlide(idx)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                idx === marketSlide
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {slide.title}
            </button>
          ))}
        </div>

        <div className="relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {currentSlide.markets.map((market) => {
              const Icon = market.icon;
              const StatusIcon = market.statusIcon;
              return (
                <div
                  key={market.name}
                  className="flex flex-col items-center gap-2 p-5 bg-slate-800/50 border border-slate-700 rounded-xl hover:border-amber-500/50 transition-colors"
                >
                  {currentSlide.isTokenSlide ? (
                    <div className="relative">
                      <TokenLogo symbol={market.name} size={40} />
                      <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-slate-800">
                        <StatusIcon
                          size={14}
                          className={
                            market.status.includes('Low') ? 'text-green-400'
                              : market.status.includes('High') ? 'text-red-400'
                              : 'text-yellow-400'
                          }
                        />
                      </div>
                    </div>
                  ) : market.isCustom ? (
                    <Icon size={36} />
                  ) : (
                    <Icon size={36} className="text-amber-400" />
                  )}
                  <span className="text-white font-medium">{market.name}</span>
                  <span className={`text-xs ${
                    market.status.includes('Low') || market.status === 'Supported' || market.status === 'Detected' || market.status === 'Info'
                      ? 'text-green-400'
                      : market.status.includes('High') || market.status === 'Blocker'
                      ? 'text-red-400'
                      : 'text-yellow-400'
                  }`}>
                    {market.status}
                  </span>
                  {market.detail && (
                    <span className="text-xs text-slate-500">{market.detail}</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="absolute top-1/2 -translate-y-1/2 -left-12 hidden md:block">
            <button
              onClick={() => setMarketSlide((p) => (p === 0 ? slides.length - 1 : p - 1))}
              className="p-2 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-400/50 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
          </div>
          <div className="absolute top-1/2 -translate-y-1/2 -right-12 hidden md:block">
            <button
              onClick={() => setMarketSlide((p) => (p === slides.length - 1 ? 0 : p + 1))}
              className="p-2 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-400/50 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="flex justify-center gap-2 mt-6">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setMarketSlide(idx)}
              className={`w-2 h-2 rounded-full transition-colors ${
                idx === marketSlide ? 'bg-amber-400' : 'bg-slate-600 hover:bg-slate-500'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function AdvancedFeaturesSection() {
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 4;
  const totalPages = Math.ceil(advancedFeatures.length / itemsPerPage);

  const colorMap = {
    amber: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
    green: 'text-green-400 bg-green-400/10 border-green-400/30',
    purple: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
    red: 'text-red-400 bg-red-400/10 border-red-400/30',
    yellow: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    blue: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    pink: 'text-pink-400 bg-pink-400/10 border-pink-400/30',
    orange: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
    cyan: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',
    emerald: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  };

  const currentFeatures = advancedFeatures.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  return (
    <section className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <h2
          className="text-3xl md:text-4xl font-bold text-center mb-2"
          style={gradientTextStyle}
        >
          Deep Analysis Features
        </h2>
        <p className="text-slate-400 text-center mb-10">
          Professional-grade migration tooling.
        </p>

        <div className="relative">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {currentFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className={`p-5 rounded-xl border transition-all hover:scale-105 ${colorMap[feature.color]}`}
                >
                  <Icon size={28} className="mb-3" />
                  <h3 className="text-sm font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-xs text-slate-400">{feature.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="p-2 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-400/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex gap-2">
              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(idx)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    idx === currentPage ? 'bg-amber-400' : 'bg-slate-600 hover:bg-slate-500'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage === totalPages - 1}
              className="p-2 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-400/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Supported chains */}
        <div className="mt-12">
          <h3 className="text-lg font-semibold text-white text-center mb-4">Supported Chains</h3>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              { name: 'Ethereum', icon: SiEthereum },
              { name: 'Polygon', icon: SiPolygon },
              { name: 'Arbitrum', icon: ArbitrumIcon, isCustom: true },
              { name: 'BSC', icon: BnbIcon, isCustom: true },
              { name: 'Base', icon: SiCoinbase },
              { name: 'Optimism', icon: SiOptimism },
              { name: 'Avalanche', icon: AvalancheIcon, isCustom: true },
              { name: 'Solana', icon: SiSolana },
            ].map((chain) => {
              const Icon = chain.icon;
              return (
                <div
                  key={chain.name}
                  className="flex flex-col items-center gap-2 p-4 bg-slate-800/50 border border-slate-700 rounded-xl hover:border-amber-500/50 transition-colors"
                >
                  {chain.isCustom ? <Icon size={28} /> : <Icon size={28} className="text-amber-400" />}
                  <span className="text-slate-300 text-sm">{chain.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- Main Page ----------

export default function LandingPage() {
  const navigate = useNavigate();
  const [address, setAddress] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleScan = (e) => {
    e.preventDefault();
    if (address.trim()) navigate(`/scan/${address.trim()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-black/90 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <DaybreakLogo size={32} />
          </div>
          <div className="hidden md:flex items-center gap-5">
            <a href="/scan" className="text-slate-400 hover:text-white transition-colors text-sm">Scanner</a>
            <a
              href="https://github.com/Jpatching/daybreak"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
            </a>
            <a
              href="/scan"
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-md transition-colors text-sm"
            >
              Scan Token
            </a>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-slate-300 hover:text-white transition-colors"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
            <div className="px-6 py-4 flex flex-col gap-3">
              <a
                href="/scan"
                className="text-slate-300 hover:text-white transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Scanner
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
              <a
                href="/scan"
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-md transition-colors text-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                Scan Token
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight"
                style={gradientTextStyleHero}
              >
                Scan Any ERC-20<br />for Solana Migration
              </h1>
              <p className="text-xl text-slate-300 mb-8" style={{ textShadow: '0 0 10px rgba(245, 158, 11, 0.3)' }}>
                Risk scoring. NTT analysis. Powered by{' '}
                <span className="text-amber-400 font-semibold">Wormhole Sunrise</span>.
              </p>

              {/* Scanner input in hero */}
              <form onSubmit={handleScan} className="flex gap-3 mb-6">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="0x token address or symbol..."
                  className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 font-mono text-sm"
                />
                <button
                  type="submit"
                  className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors text-lg"
                >
                  Scan
                </button>
              </form>

              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="https://github.com/Jpatching/daybreak#quickstart"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors text-lg flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                  </svg>
                  View on GitHub
                </a>
              </div>
            </div>

            {/* Right - Terminal Preview */}
            <div className="flex justify-center md:justify-end">
              <div className="w-full max-w-lg rounded-xl overflow-hidden border border-slate-600 shadow-2xl" style={{ boxShadow: '0 0 60px rgba(245, 158, 11, 0.15), 0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                <div className="bg-slate-800 px-4 py-3 flex items-center gap-3 border-b border-slate-700">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="bg-slate-700/50 rounded-md px-4 py-1.5 flex items-center gap-2 text-xs text-slate-400 max-w-xs">
                      <Lock size={12} />
                      <span>daybreak scan ONDO</span>
                    </div>
                  </div>
                  <div className="w-16"></div>
                </div>
                <div className="bg-slate-900 p-4 font-mono text-xs text-slate-300 space-y-1">
                  <div className="text-slate-600">{"\u2550".repeat(48)}</div>
                  <div className="text-white font-semibold">  Ondo Finance (ONDO) on Ethereum</div>
                  <div className="text-slate-600">{"\u2550".repeat(48)}</div>
                  <div className="mt-2 text-slate-500">&mdash;&mdash; Token Information &mdash;&mdash;</div>
                  <div>  Decimals:     <span className="text-white">18</span></div>
                  <div>  Total Supply: <span className="text-white">10,000,000,000</span></div>
                  <div className="mt-2 text-slate-500">&mdash;&mdash; Capabilities &mdash;&mdash;</div>
                  <div>  Mintable     <span className="text-green-400">Yes</span></div>
                  <div>  Burnable     <span className="text-slate-500">No</span></div>
                  <div>  Pausable     <span className="text-slate-500">No</span></div>
                  <div className="mt-2 text-slate-500">&mdash;&mdash; NTT Compatibility &mdash;&mdash;</div>
                  <div>  Status:      <span className="text-green-400">Compatible</span></div>
                  <div>  Mode:        <span className="text-amber-400">Locking</span></div>
                  <div>  Decimals:    <span className="text-white">18 &rarr; 8</span> <span className="text-yellow-400">(trimming)</span></div>
                  <div className="mt-2 text-slate-500">&mdash;&mdash; Risk Score &mdash;&mdash;</div>
                  <div>  Score:       <span className="text-green-400">36/100 (Low)</span></div>
                  <div className="mt-2 text-green-400">&check; Strong candidate for NTT migration via Sunrise</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ecosystem / Branding */}
      <section className="py-10 px-6 border-y border-slate-700/30">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-slate-500 text-xs uppercase tracking-widest mb-6">Built for the Sunrise Ecosystem</p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-8 sm:gap-12">
            <div className="flex items-center gap-3">
              <WormholeIcon size={36} />
              <div>
                <div className="text-white font-semibold text-sm">Wormhole</div>
                <div className="text-slate-500 text-xs">NTT Protocol</div>
              </div>
            </div>
            <div className="hidden sm:block w-px h-10 bg-slate-700" />
            <div className="flex items-center gap-3">
              <SunriseIcon size={36} />
              <div>
                <div className="text-white font-semibold text-sm">Sunrise</div>
                <div className="text-slate-500 text-xs">Liquidity Gateway</div>
              </div>
            </div>
            <div className="hidden sm:block w-px h-10 bg-slate-700" />
            <div className="flex items-center gap-3">
              <SiSolana size={36} className="text-[#9945FF]" />
              <div>
                <div className="text-white font-semibold text-sm">Solana</div>
                <div className="text-slate-500 text-xs">Target Chain</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <UserTypeSection />

      {/* Stats */}
      <section className="py-8 border-y border-slate-700/50 overflow-hidden">
        <div
          className="flex gap-16 animate-scroll-stats"
          style={{ width: 'max-content' }}
        >
          {[...stats, ...stats].map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div key={`stat-${idx}`} className="text-center flex-shrink-0">
                <div className="text-3xl md:text-4xl font-bold text-amber-400 flex justify-center">
                  {stat.value ? stat.value : <Icon size={36} strokeWidth={1.5} />}
                </div>
                <div className="text-slate-400 text-sm mt-1">{stat.label}</div>
              </div>
            );
          })}
        </div>
        <style>{`
          @keyframes scroll-stats {
            0% { transform: translateX(0); }
            100% { transform: translateX(-25%); }
          }
          .animate-scroll-stats {
            animation: scroll-stats 20s linear infinite;
          }
        `}</style>
      </section>

      {/* Deployment Options */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-2" style={gradientTextStyle}>
            Install & run
          </h2>
          <p className="text-slate-400 text-center mb-10">
            Rust CLI. Single binary. No runtime dependencies.
          </p>

          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-6 py-4 bg-slate-800 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">CLI Tool</h3>
                  <p className="text-slate-400 text-sm">Install from source, scan any token</p>
                </div>
                <span className="px-3 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full">Rust</span>
              </div>
            </div>
            <pre className="p-4 overflow-x-auto">
              <code className="text-xs text-slate-300 font-mono whitespace-pre">{codeExample}</code>
            </pre>
            <div className="px-6 py-3 bg-slate-800/50 border-t border-slate-700 text-xs text-slate-400">
              7 chains &bull; 8 commands &bull; risk scoring &bull; NTT analysis &bull; SPL deployment
            </div>
          </div>
        </div>
      </section>

      {/* Features - Conveyor Belt */}
      <section className="mt-8 pb-0 bg-slate-800/30 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center mb-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-2" style={gradientTextStyle}>
            Everything you need to migrate
          </h2>
          <p className="text-slate-400">
            Complete tooling for EVM-to-Solana token migration via Wormhole NTT.
          </p>
        </div>

        {/* Row 1 - scrolls left */}
        <div className="relative mb-6">
          <div className="flex gap-6 animate-scroll-left" style={{ width: 'max-content' }}>
            {[...features, ...features].map((feature, idx) => (
              <div
                key={`row1-${idx}`}
                className="flex-shrink-0 p-6 bg-slate-800/60 border border-slate-700 rounded-xl"
                style={{ width: '400px' }}
              >
                <h3 className="text-base font-semibold text-white mb-1">{feature.title}</h3>
                <p className="text-slate-400 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Row 2 - scrolls right */}
        <div className="relative">
          <div className="flex gap-6 animate-scroll-right" style={{ width: 'max-content' }}>
            {[...features, ...features].map((feature, idx) => (
              <div
                key={`row2-${idx}`}
                className="flex-shrink-0 p-6 bg-slate-800/60 border border-slate-700 rounded-xl"
                style={{ width: '400px' }}
              >
                <h3 className="text-base font-semibold text-white mb-1">{feature.title}</h3>
                <p className="text-slate-400 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        <style>{`
          @keyframes scroll-left {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          @keyframes scroll-right {
            0% { transform: translateX(-50%); }
            100% { transform: translateX(0); }
          }
          .animate-scroll-left {
            animation: scroll-left 30s linear infinite;
          }
          .animate-scroll-right {
            animation: scroll-right 30s linear infinite;
          }
        `}</style>
      </section>

      {/* Markets / Analysis */}
      <MarketsSection />

      {/* Advanced Features */}
      <AdvancedFeaturesSection />

      {/* FAQ & Security */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-2" style={gradientTextStyle}>
            FAQ
          </h2>
          <p className="text-slate-400 text-center mb-10">
            Common questions about Daybreak and token migration.
          </p>

          <div className="space-y-4">
            {[
              {
                q: 'What is Wormhole NTT?',
                a: 'Native Token Transfers (NTT) is Wormhole\'s framework for bringing tokens to new chains natively \u2014 not as wrapped assets. Tokens retain full utility and fungibility.',
              },
              {
                q: 'What\'s the difference between Locking and Burning mode?',
                a: 'Locking: tokens are locked on the source chain and minted on Solana. Burning: tokens are burned on source and minted on Solana. Burning requires the token to have burn capability.',
              },
              {
                q: 'Why does decimal trimming matter?',
                a: 'ERC-20 tokens typically use 18 decimals, but Solana SPL tokens use 8. The 10-digit precision loss means tiny dust amounts (< 0.00000001 tokens) can\'t be bridged. Dust is recoverable if bridged back.',
              },
              {
                q: 'Can rebasing tokens migrate?',
                a: 'Not directly. Rebasing tokens (like stETH) change balances automatically, which desyncs locked amounts from minted supply. Use a non-rebasing wrapper (like wstETH) instead.',
              },
              {
                q: 'What is Sunrise?',
                a: 'Sunrise is Wormhole\'s day-one liquidity gateway for Solana. It provides immediate liquidity for bridged assets so tokens aren\'t stranded on arrival.',
              },
              {
                q: 'Is Daybreak open source?',
                a: 'Yes. MIT license. You can audit every line, fork it, modify it. Built in Rust with 60+ unit tests.',
              },
              {
                q: 'Which chains are supported?',
                a: 'Ethereum, Polygon, BSC, Arbitrum, Base, Optimism, and Avalanche. Any chain with an Etherscan-compatible block explorer API.',
              },
            ].map((faq, idx) => (
              <div key={idx} className="p-5 bg-slate-800/50 rounded-xl border border-slate-700">
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <Shield size={18} className="text-amber-400" />
                  {faq.q}
                </h3>
                <p className="text-slate-400 text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-slate-800/30">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-2" style={gradientTextStyle}>
            Ready to migrate?
          </h2>
          <p className="text-slate-400 mb-8">
            Daybreak is free, open source, and built for Wormhole Sunrise.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/scan"
              className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors"
            >
              Launch Scanner
            </a>
            <a
              href="https://github.com/Jpatching/daybreak"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
            >
              Star on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-slate-700">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <DaybreakLogo size={20} />
            <span className="text-slate-500 text-sm">ERC-20 &rarr; Solana</span>
          </div>
          <div className="flex items-center gap-6 text-slate-400 text-sm flex-wrap justify-center">
            <a href="/scan" className="hover:text-white transition-colors">Scanner</a>
            <a href="https://github.com/Jpatching/daybreak" className="hover:text-white transition-colors">GitHub</a>
            <a href="https://wormhole.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
              <WormholeIcon size={14} />
              Wormhole
            </a>
            <a href="https://solana.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
              <SiSolana size={14} />
              Solana
            </a>
            <span>MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
