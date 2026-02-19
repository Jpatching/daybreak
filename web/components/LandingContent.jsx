'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { fetchStats, fetchRecentScans, fetchLeaderboard } from '@/lib/api';
import {
  Shield,
  Search,
  Layers,
  Globe,
  Lock,
  Zap,
  Terminal,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BarChart2,
  Activity,
  Target,
  Eye,
  Bot,
  ArrowRight,
  Github,
  Database,
  Cpu,
  Rocket,
  Scale,
  Skull,
  TrendingUp,
  Users,
  Wallet,
  Link2,
  ExternalLink,
} from 'lucide-react';
import { SiSolana } from '@icons-pack/react-simple-icons';

const SunriseShader = dynamic(() => import('./SunriseShader'), { ssr: false });

// ---------- Branding SVG components ----------

function PumpFunIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <rect width="40" height="40" rx="20" fill="#0d1117" />
      <text x="20" y="26" textAnchor="middle" fill="#22c55e" fontSize="18" fontWeight="bold">P</text>
    </svg>
  );
}

function HeliusIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <rect width="40" height="40" rx="20" fill="#1a0800" />
      <defs>
        <linearGradient id="hel-g" x1="20" y1="14" x2="20" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbbf24" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="10" fill="url(#hel-g)" />
    </svg>
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

// ---------- Helper ----------

function truncAddr(addr) {
  if (!addr) return '...';
  return addr.slice(0, 4) + '...' + addr.slice(-4);
}

// ---------- Recent Scans Feed ----------

function RecentScansFeed() {
  const [scans, setScans] = useState([]);
  const router = useRouter();

  useEffect(() => {
    fetchRecentScans().then(data => { if (data?.length) setScans(data); }).catch(() => {});
  }, []);

  if (scans.length === 0) return null;

  const verdictConfig = {
    CLEAN: { color: 'text-green-400', bg: 'bg-green-500/10', dot: 'bg-green-400', icon: CheckCircle2 },
    SUSPICIOUS: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', dot: 'bg-yellow-400', icon: AlertTriangle },
    SERIAL_RUGGER: { color: 'text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-400', icon: Skull },
  };

  return (
    <div className="mt-8">
      <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">Recently Scanned</p>
      <div className="space-y-2">
        {scans.slice(0, 4).map((scan, i) => {
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
                <span className="text-xs text-slate-500 ml-2 font-mono">
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
  );
}

// ---------- Leaderboard Preview ----------

function LeaderboardPreview() {
  const [notorious, setNotorious] = useState([]);
  const router = useRouter();

  useEffect(() => {
    fetchLeaderboard('notorious').then(data => { if (data?.length) setNotorious(data.slice(0, 5)); }).catch(() => {});
  }, []);

  if (notorious.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
          <Skull size={12} /> Most Notorious Deployers
        </p>
        <Link href="/leaderboard" className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
          View all &rarr;
        </Link>
      </div>
      <div className="space-y-2">
        {notorious.map((row, i) => (
          <button
            key={row.deployer_wallet}
            onClick={() => router.push(`/scan/${row.deployer_wallet}`)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-700/50 hover:border-red-500/30 transition-all text-left bg-red-500/5"
          >
            <span className="text-xs text-slate-500 font-mono w-5">{i + 1}</span>
            <Skull size={14} className="text-red-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-white font-mono">{truncAddr(row.deployer_wallet)}</span>
              <span className="text-xs text-slate-500 ml-2">{row.token_count} tokens</span>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-sm font-bold font-mono text-red-400">{row.rug_rate}%</span>
              <span className="block text-[10px] text-red-400/70">rug rate</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Live Stats ----------

function LiveStats() {
  const [liveStats, setLiveStats] = useState(null);

  useEffect(() => {
    fetchStats().then(data => { if (data) setLiveStats(data); }).catch(() => {});
  }, []);

  if (!liveStats || liveStats.total_scans === 0) return null;

  const fmt = (n) => new Intl.NumberFormat().format(n);

  return (
    <div className="flex flex-wrap justify-center gap-6 mt-8">
      <div className="text-center">
        <div className="text-2xl font-bold text-amber-400">{fmt(liveStats.total_scans)}</div>
        <div className="text-xs text-slate-500">Scans Completed</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-green-400">{fmt(liveStats.verdicts.CLEAN)}</div>
        <div className="text-xs text-slate-500">Clean</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-yellow-400">{fmt(liveStats.verdicts.SUSPICIOUS)}</div>
        <div className="text-xs text-slate-500">Suspicious</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-red-400">{fmt(liveStats.verdicts.SERIAL_RUGGER)}</div>
        <div className="text-xs text-slate-500">Serial Ruggers</div>
      </div>
    </div>
  );
}

// ---------- Spotlight Bento Grid ----------

const bentoFeatures = [
  { tag: '0-100', title: 'Reputation Score', desc: 'Bayesian composite score across rug rate, token count, average lifespan, and cluster connections.', color: 'amber', hero: true },
  { tag: 'RUG', title: 'Rug Detection', desc: 'Automatic dead token identification via DexScreener liquidity checks. Calculates deployer death rate.', color: 'red', hero: true },
  { tag: 'FUND', title: 'Funding Trace', desc: 'Tracks earliest incoming SOL to deployer wallet. Identifies the funding source and CEX origins.', color: 'blue' },
  { tag: 'NET', title: 'Cluster Analysis', desc: 'Scans funder outgoing transfers. Finds linked deployers and coordinated rug networks.', color: 'purple' },
  { tag: 'PF', title: 'Pump.fun Detection', desc: 'Identifies Pump.fun token creations from enhanced transaction history.', color: 'green' },
  { tag: 'LIVE', title: 'Live Scanning', desc: 'Real-time deployer analysis. Connect wallet, paste address, get results in seconds.', color: 'cyan', hero: true },
  { tag: 'RISK', title: 'Token Risk Signals', desc: 'Mint/freeze authority, bundle detection, top holder concentration, deployer holdings.', color: 'orange' },
  { tag: 'MCP', title: 'MCP Server', desc: 'Stdio JSON-RPC server for AI agent integration. Claude Code, Cursor, Windsurf compatible.', color: 'yellow' },
  { tag: 'API', title: 'REST API', desc: 'api.daybreakscan.com. Auth-protected endpoints for deployer and wallet scanning.', color: 'emerald' },
  { tag: 'x402', title: 'Pay-Per-Scan', desc: '$0.01 USDC per scan via x402 protocol. No subscription, no signup required.', color: 'purple' },
  { tag: 'MIT', title: 'Open Source', desc: 'Full source code on GitHub. MIT licensed. Verify every line of the scoring algorithm.', color: 'pink' },
];

const bentoIconColors = {
  amber: 'text-amber-400',
  green: 'text-green-400',
  purple: 'text-purple-400',
  blue: 'text-blue-400',
  orange: 'text-orange-400',
  red: 'text-red-400',
  emerald: 'text-emerald-400',
  cyan: 'text-cyan-400',
  pink: 'text-pink-400',
  yellow: 'text-yellow-400',
};

function BentoFeaturesSection() {
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef(null);
  const cardsRef = useRef([]);
  const spotsRef = useRef([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const handlePointerMove = (e) => {
    cardsRef.current.forEach((card, i) => {
      if (!card || !spotsRef.current[i]) return;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      spotsRef.current[i].style.background =
        `radial-gradient(600px circle at ${x}px ${y}px, rgba(251, 191, 36, 0.06), transparent 40%)`;
      spotsRef.current[i].style.opacity = '1';
    });
  };

  const handlePointerLeave = () => {
    spotsRef.current.forEach(spot => {
      if (spot) spot.style.opacity = '0';
    });
  };

  return (
    <section ref={sectionRef} className="py-20 px-6 relative z-10">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-2" style={gradientTextStyle}>
          What DaybreakScan Analyzes
        </h2>
        <p className="text-slate-400 text-center mb-12">
          Complete deployer intelligence for Solana token analysis.
        </p>

        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          style={{ gridAutoFlow: 'dense' }}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          {bentoFeatures.map((feature, i) => (
              <div
                key={feature.title}
                ref={el => { cardsRef.current[i] = el; }}
                className={`group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl hover:border-amber-400/20 hover:bg-white/[0.06] ${feature.hero ? 'sm:col-span-2' : ''}`}
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(24px)',
                  transition: `opacity 0.6s ease ${i * 60}ms, transform 0.6s ease ${i * 60}ms, border-color 0.3s, background-color 0.3s`,
                }}
              >
                <div
                  ref={el => { spotsRef.current[i] = el; }}
                  className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-500"
                />
                <div className="relative z-10 p-6">
                  <span className={`inline-block px-2.5 py-1 rounded-lg bg-white/[0.05] mb-4 font-mono text-xs font-bold tracking-wide ${bentoIconColors[feature.color]}`}>
                    {feature.tag}
                  </span>
                  <h3 className="text-white font-semibold text-sm mb-2">{feature.title}</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">{feature.desc}</p>
                </div>
              </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- Verdicts Section ----------

function VerdictsSection() {
  const verdicts = [
    { name: 'CLEAN', icon: CheckCircle2, status: 'Score 70-100', detail: 'Safe deployer', color: 'green' },
    { name: 'SUSPICIOUS', icon: AlertTriangle, status: 'Score 30-70', detail: 'Moderate risk', color: 'yellow' },
    { name: 'SERIAL RUGGER', icon: XCircle, status: 'Score 0-30', detail: '>70% rug rate', color: 'red' },
    { name: 'Rug Rate', icon: Skull, status: 'Key Metric', detail: 'Dead / Total tokens', color: 'amber' },
  ];

  return (
    <section className="py-20 px-6 bg-slate-900/60 backdrop-blur-sm relative z-10">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-2" style={gradientTextStyle}>
          Three-Tier Verdict System
        </h2>
        <p className="text-slate-400 text-center mb-8">Every deployer gets a score and a verdict.</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {verdicts.map((v) => {
            const Icon = v.icon;
            return (
              <div
                key={v.name}
                className="flex flex-col items-center gap-2 p-5 bg-slate-800/50 border border-slate-700 rounded-xl hover:border-amber-500/50 transition-colors"
              >
                <Icon size={36} className={
                  v.color === 'green' ? 'text-green-400'
                    : v.color === 'red' ? 'text-red-400'
                    : v.color === 'yellow' ? 'text-yellow-400'
                    : 'text-amber-400'
                } />
                <span className="text-white font-medium">{v.name}</span>
                <span className={`text-xs ${
                  v.color === 'green' ? 'text-green-400'
                    : v.color === 'red' ? 'text-red-400'
                    : v.color === 'yellow' ? 'text-yellow-400'
                    : 'text-amber-400'
                }`}>{v.status}</span>
                {v.detail && <span className="text-xs text-slate-500">{v.detail}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---------- Main Content ----------

export default function LandingContent() {
  const router = useRouter();
  const { connected } = useWallet();
  const [address, setAddress] = useState('');

  const handleScan = (e) => {
    e.preventDefault();
    if (address.trim()) router.push(`/scan/${address.trim()}`);
  };

  return (
    <div className="min-h-screen relative">
      <SunriseShader />
      <div className="fixed inset-0 z-[1] pointer-events-none bg-gradient-to-b from-slate-900/40 via-slate-900/30 to-slate-900/70" />

      {/* Hero */}
      <section className="pt-28 pb-16 px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight"
                style={gradientTextStyleHero}
              >
                Check Any Deployer<br />Before You Trade
              </h1>
              <p className="text-xl text-slate-300 mb-8" style={{ textShadow: '0 0 10px rgba(245, 158, 11, 0.3)' }}>
                Find out if the deployer has rugged before.{' '}
                <span className="text-amber-400 font-semibold">Free for 3 scans/day.</span>
              </p>

              <form onSubmit={handleScan} className="flex gap-3 mb-4">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Paste a Solana token address..."
                  className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 font-mono text-sm"
                />
                <button
                  type="submit"
                  className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors text-lg"
                >
                  Scan
                </button>
              </form>

              <div className="flex flex-col sm:flex-row gap-4 mb-2">
                <a
                  href="https://github.com/Jpatching/daybreak"
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

              <LiveStats />
              <RecentScansFeed />
              <LeaderboardPreview />
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
                      <span>daybreak deployer scan</span>
                    </div>
                  </div>
                  <div className="w-16"></div>
                </div>
                <div className="bg-slate-900 p-4 font-mono text-xs text-slate-300 space-y-1">
                  <div className="text-slate-600">{"\u2550".repeat(48)}</div>
                  <div className="text-white font-semibold">  Deployer Reputation Scan</div>
                  <div className="text-slate-600">{"\u2550".repeat(48)}</div>
                  <div className="mt-2 text-slate-500">&mdash;&mdash; Token &mdash;&mdash;</div>
                  <div>  Name:        <span className="text-white">ShadyToken (SHADY)</span></div>
                  <div>  Address:     <span className="text-slate-400">7xKQ...pump</span></div>
                  <div className="mt-2 text-slate-500">&mdash;&mdash; Deployer &mdash;&mdash;</div>
                  <div>  Wallet:      <span className="text-slate-400">Dk9f...3xYp</span></div>
                  <div>  Tokens:      <span className="text-white">194</span> created</div>
                  <div>  Dead:        <span className="text-red-400">157</span> (<span className="text-red-400">80.9%</span>)</div>
                  <div className="mt-2 text-slate-500">&mdash;&mdash; Reputation &mdash;&mdash;</div>
                  <div>  Score:       <span className="text-red-400">8/100</span></div>
                  <div>  Verdict:     <span className="text-red-400 font-bold">SERIAL_RUGGER</span></div>
                  <div className="mt-2 text-slate-500">&mdash;&mdash; Funding &mdash;&mdash;</div>
                  <div>  Source:      <span className="text-slate-400">Hx7m...9aKz</span></div>
                  <div>  Cluster:     <span className="text-yellow-400">12 linked deployers</span></div>
                  <div className="mt-2 text-red-400">&cross; Do NOT ape. Serial rugger with cluster activity.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Powered By */}
      <section className="py-10 px-6 border-y border-white/5 relative z-10 bg-slate-900/60 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-slate-500 text-xs uppercase tracking-widest mb-6">Powered By</p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-8 sm:gap-12">
            <div className="flex items-center gap-3">
              <SiSolana size={36} className="text-[#9945FF]" />
              <div>
                <div className="text-white font-semibold text-sm">Solana</div>
                <div className="text-slate-500 text-xs">On-Chain Data</div>
              </div>
            </div>
            <div className="hidden sm:block w-px h-10 bg-slate-700" />
            <div className="flex items-center gap-3">
              <PumpFunIcon size={36} />
              <div>
                <div className="text-white font-semibold text-sm">Pump.fun</div>
                <div className="text-slate-500 text-xs">Token Detection</div>
              </div>
            </div>
            <div className="hidden sm:block w-px h-10 bg-slate-700" />
            <div className="flex items-center gap-3">
              <HeliusIcon size={36} />
              <div>
                <div className="text-white font-semibold text-sm">Helius</div>
                <div className="text-slate-500 text-xs">Enhanced API</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features - Bento Grid */}
      <BentoFeaturesSection />

      {/* Verdicts */}
      <VerdictsSection />

      {/* FAQ */}
      <section className="py-20 px-6 relative z-10">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-2" style={gradientTextStyle}>
            FAQ
          </h2>
          <p className="text-slate-400 text-center mb-10">
            Common questions about DaybreakScan.
          </p>

          <div className="space-y-4">
            {[
              {
                q: 'What does DaybreakScan do?',
                a: 'DaybreakScan scans any Solana token address and analyzes the deployer\'s on-chain history. It calculates a reputation score based on how many tokens they\'ve created, how many are dead (rugged), and their funding network.',
              },
              {
                q: 'How does rug detection work?',
                a: 'We check each of the deployer\'s tokens against DexScreener for liquidity. Tokens with less than $100 liquidity and no 24h volume are classified as dead. The death rate is dead tokens / total tokens.',
              },
              {
                q: 'What is a reputation score?',
                a: 'A Bayesian 0-100 composite score. It weighs death rate (40%), token count penalty (20%), average token lifespan (20%), and cluster connections (20%). Additional penalties for active mint/freeze authority, bundled launches, and concentrated holdings. Higher is better: 70+ is CLEAN, below 30 is SERIAL_RUGGER.',
              },
              {
                q: 'What is cluster analysis?',
                a: 'We trace who funded the deployer\'s wallet, then check if that funder also funded other Pump.fun deployers. This reveals rug networks where one entity controls many deployer wallets.',
              },
              {
                q: 'Why do I need to connect my wallet?',
                a: 'Wallet authentication protects our Helius API credits. Each scan costs 50-100 API calls. You sign a message to prove wallet ownership \u2014 no transactions, no seed phrases, no funds at risk. You get 1 free scan without connecting, or 3/day with a wallet.',
              },
              {
                q: 'What are the scan limits?',
                a: '1 free scan without a wallet. Connect your Solana wallet for 3 free scans per day. Need more? Pay $0.01 USDC per scan via x402 protocol \u2014 no subscription, no signup.',
              },
              {
                q: 'Is DaybreakScan open source?',
                a: 'Yes. MIT license. The full backend, frontend, and MCP server are on GitHub. Verify every line of the scoring algorithm yourself.',
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
      <section className="py-20 px-6 bg-slate-900/60 backdrop-blur-sm relative z-10">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-2" style={gradientTextStyle}>
            The next token you almost ape into
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Check the deployer first.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/scan"
              className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors text-lg"
            >
              Launch Scanner
            </Link>
            <a
              href="https://github.com/Jpatching/daybreak"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
            >
              Star on GitHub
            </a>
          </div>
          <p className="text-xs text-slate-600 mt-6">
            Free, open source, built for Solana. MIT licensed.
          </p>
        </div>
      </section>
    </div>
  );
}
