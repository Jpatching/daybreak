import Link from 'next/link';
import { SiSolana } from '@icons-pack/react-simple-icons';

function DaybreakLogo({ size = 20 }) {
  return (
    <img
      src="/daybreak-logo-square.png"
      alt="Daybreak"
      style={{ width: size, height: size }}
      className="object-contain rounded-lg"
    />
  );
}

function XIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="py-8 px-6 border-t border-white/5 relative z-10 bg-slate-900/80 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <DaybreakLogo />
          <span className="text-slate-500 text-sm">Solana Deployer Reputation</span>
        </div>
        <div className="flex items-center gap-6 text-slate-400 text-sm flex-wrap justify-center">
          <Link href="/scan" className="hover:text-white transition-colors">Scanner</Link>
          <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          <a href="https://github.com/Jpatching/daybreak" className="hover:text-white transition-colors">GitHub</a>
          <a href="https://x.com/DaybreakScan" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
            <XIcon />
            Twitter
          </a>
          <a href="https://solana.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
            <SiSolana size={14} />
            Solana
          </a>
          <span>MIT License</span>
        </div>
      </div>
    </footer>
  );
}
