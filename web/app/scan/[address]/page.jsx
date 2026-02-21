import ScannerClient from '@/components/ScannerClient';

const BOT_API = process.env.BOT_API_URL || 'https://api.daybreakscan.com/api/v1';
const BOT_KEY = process.env.BOT_API_KEY || '';

export async function generateMetadata({ params }) {
  const { address } = await params;
  const truncated = address.slice(0, 8) + '...';

  // Try to fetch scan data server-side for rich OG tags
  try {
    if (BOT_KEY) {
      const res = await fetch(`${BOT_API}/bot/deployer/${address}`, {
        headers: { 'X-Bot-Key': BOT_KEY },
        next: { revalidate: 300 }, // cache 5 min
      });

      if (res.ok) {
        const data = await res.json();
        const symbol = data.token?.symbol || truncated;
        const verdict = data.verdict || 'UNKNOWN';
        const score = data.deployer?.reputation_score ?? '?';
        const deathRate = data.deployer?.death_rate ?? data.deployer?.rug_rate;
        const deathPct = deathRate != null ? `${(deathRate * 100).toFixed(1)}%` : '';

        const title = `$${symbol} — ${verdict} (${score}/100)`;
        const description = deathPct
          ? `Deployer verdict: ${verdict}. Score: ${score}/100. Death rate: ${deathPct}. Scanned on DaybreakScan.`
          : `Deployer verdict: ${verdict}. Score: ${score}/100. Scanned on DaybreakScan.`;

        return {
          title,
          description,
          alternates: { canonical: `/scan/${address}` },
          openGraph: {
            title,
            description,
            url: `/scan/${address}`,
            images: [{ url: `https://api.daybreakscan.com/api/v1/report/${address}/twitter.png`, width: 1200, height: 630 }],
          },
          twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [{ url: `https://api.daybreakscan.com/api/v1/report/${address}/twitter.png`, width: 1200, height: 630 }],
          },
        };
      }
    }
  } catch {
    // Fall through to default metadata
  }

  // Fallback metadata when bot API is unavailable — use generic OG image
  // (report card PNG may not exist for unscanned tokens)
  return {
    title: `Deployer Scan: ${truncated}`,
    description: `Check this deployer's reputation on DaybreakScan — rug detection, cluster analysis, and scoring.`,
    alternates: { canonical: `/scan/${address}` },
    robots: { index: false, follow: true },
    openGraph: {
      title: `Deployer Scan: ${truncated}`,
      description: `Check this deployer's reputation on DaybreakScan.`,
      url: `/scan/${address}`,
      images: [{ url: `https://www.daybreakscan.com/og?address=${address}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Deployer Scan: ${truncated}`,
      description: `Check this deployer's reputation on DaybreakScan.`,
      images: [{ url: `https://www.daybreakscan.com/og?address=${address}`, width: 1200, height: 630 }],
    },
  };
}

export default async function ScanAddressPage({ params }) {
  const { address } = await params;
  return <ScannerClient initialAddress={address} />;
}
