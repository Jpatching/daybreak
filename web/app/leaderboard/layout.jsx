export const metadata = {
  title: 'Leaderboard — DaybreakScan',
  description: 'Top scanned tokens and most notorious deployers on Solana. See which deployers have the highest rug rates.',
  alternates: { canonical: '/leaderboard' },
  openGraph: {
    title: 'Leaderboard — DaybreakScan',
    description: 'Top scanned tokens and most notorious deployers on Solana.',
    url: '/leaderboard',
  },
  twitter: {
    card: 'summary',
    title: 'Leaderboard — DaybreakScan',
    description: 'Top scanned tokens and most notorious deployers on Solana.',
  },
};

export default function LeaderboardLayout({ children }) {
  return children;
}
