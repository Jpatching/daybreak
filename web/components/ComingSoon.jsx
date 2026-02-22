'use client';

import { Clock, Sparkles } from 'lucide-react';

export default function ComingSoon({ title, description }) {
  return (
    <div className="p-6 bg-slate-800/30 rounded-xl border border-slate-700/50 border-dashed">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
          <Sparkles size={16} className="text-amber-400/60" />
        </div>
        <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400/80 text-[10px] font-bold rounded-full uppercase tracking-wider">
          Coming Soon
        </span>
      </div>
      {description && (
        <p className="text-xs text-slate-500 ml-11">{description}</p>
      )}
    </div>
  );
}
