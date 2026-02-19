'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchLeaderboard } from '@/lib/api';
import {
  TrendingUp,
  Skull,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

const gradientTextStyle = {
  background: 'linear-gradient(180deg, #ffffff 0%, #f59e0b 50%, #d97706 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  filter: 'drop-shadow(0 0 15px rgba(245, 158, 11, 0.4))',
};

function truncAddr(addr) {
  if (!addr) return '...';
  return addr.slice(0, 4) + '...' + addr.slice(-4);
}

const verdictConfig = {
  CLEAN: { color: 'text-green-400', bg: 'bg-green-500/20', icon: CheckCircle2 },
  SUSPICIOUS: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: AlertTriangle },
  SERIAL_RUGGER: { color: 'text-red-400', bg: 'bg-red-500/20', icon: Skull },
};

function VerdictBadge({ verdict }) {
  if (!verdict) return null;
  const c = verdictConfig[verdict] || verdictConfig.SUSPICIOUS;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${c.bg} ${c.color}`}>
      <Icon size={12} />
      {verdict.replace('_', ' ')}
    </span>
  );
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState('most_scanned');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard(tab)
      .then(d => setData(d || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-2" style={gradientTextStyle}>
            Leaderboard
          </h1>
          <p className="text-slate-400 text-center mb-8">
            Top scanned tokens and most notorious deployers.
          </p>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 justify-center">
            <button
              onClick={() => setTab('most_scanned')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'most_scanned'
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              <TrendingUp size={14} className="inline mr-1.5 -mt-0.5" />
              Most Scanned (7d)
            </button>
            <button
              onClick={() => setTab('notorious')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'notorious'
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              <Skull size={14} className="inline mr-1.5 -mt-0.5" />
              Most Notorious
            </button>
          </div>

          {loading && (
            <div className="text-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto" />
            </div>
          )}

          {!loading && data.length === 0 && (
            <div className="text-center py-16">
              <p className="text-slate-500">No data yet. Scan some tokens to populate the leaderboard.</p>
            </div>
          )}

          {!loading && data.length > 0 && tab === 'most_scanned' && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-700">
                    <th className="text-left p-4 w-12">#</th>
                    <th className="text-left p-4">Token</th>
                    <th className="text-left p-4">Verdict</th>
                    <th className="text-right p-4">Score</th>
                    <th className="text-right p-4">Scans</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr
                      key={row.token_address}
                      onClick={() => router.push(`/scan/${row.token_address}`)}
                      className="border-b border-slate-700/50 hover:bg-slate-700/20 cursor-pointer transition-colors"
                    >
                      <td className="p-4 text-slate-500 font-mono">{i + 1}</td>
                      <td className="p-4">
                        <div className="text-white font-medium">
                          {row.token_name || row.token_symbol || truncAddr(row.token_address)}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">{truncAddr(row.token_address)}</div>
                      </td>
                      <td className="p-4">
                        <VerdictBadge verdict={row.verdict} />
                      </td>
                      <td className="p-4 text-right font-mono text-slate-300">{row.score ?? '-'}</td>
                      <td className="p-4 text-right font-mono text-amber-400">{row.scan_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && data.length > 0 && tab === 'notorious' && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-700">
                    <th className="text-left p-4 w-12">#</th>
                    <th className="text-left p-4">Deployer</th>
                    <th className="text-right p-4">Tokens</th>
                    <th className="text-right p-4">Dead</th>
                    <th className="text-right p-4">Rug Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr
                      key={row.deployer_wallet}
                      onClick={() => router.push(`/scan/${row.deployer_wallet}`)}
                      className="border-b border-slate-700/50 hover:bg-slate-700/20 cursor-pointer transition-colors"
                    >
                      <td className="p-4 text-slate-500 font-mono">{i + 1}</td>
                      <td className="p-4">
                        <div className="text-white font-medium font-mono">{truncAddr(row.deployer_wallet)}</div>
                      </td>
                      <td className="p-4 text-right font-mono text-slate-300">{row.token_count}</td>
                      <td className="p-4 text-right font-mono text-red-400">{row.dead_count}</td>
                      <td className="p-4 text-right">
                        <span className={`font-mono font-bold ${
                          row.rug_rate > 70 ? 'text-red-400' : row.rug_rate > 30 ? 'text-yellow-400' : 'text-green-400'
                        }`}>
                          {row.rug_rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
