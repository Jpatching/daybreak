import ScannerClient from '@/components/ScannerClient';

const BOT_API = process.env.BOT_API_URL || 'https://api.daybreakscan.com/api/v1';
const BOT_KEY = process.env.BOT_API_KEY || '';

async function fetchScanData(address) {
  if (!BOT_KEY) return null;
  try {
    const res = await fetch(`${BOT_API}/bot/deployer/${address}`, {
      headers: { 'X-Bot-Key': BOT_KEY },
      next: { revalidate: 300 },
    });
    if (res.ok) return await res.json();
  } catch {
    // Fall through
  }
  return null;
}

export async function generateMetadata({ params }) {
  const { address } = await params;
  const truncated = address.slice(0, 8) + '...';

  const data = await fetchScanData(address);

  if (data) {
    const name = data.token?.name || truncated;
    const symbol = data.token?.symbol || truncated;
    const verdict = data.verdict || 'UNKNOWN';
    const score = data.deployer?.reputation_score ?? '?';
    const deathRate = data.deployer?.death_rate ?? data.deployer?.rug_rate;
    const deathPct = deathRate != null ? `${(deathRate * 100).toFixed(1)}%` : '';
    const totalTokens = data.deployer?.tokens_created ?? 0;

    const title = `$${symbol} — ${verdict} (${score}/100)`;
    const description = deathPct
      ? `${name} ($${symbol}) deployer scored ${score}/100 — ${deathPct} death rate, ${totalTokens} tokens created. Verdict: ${verdict}.`
      : `${name} ($${symbol}) deployer scored ${score}/100. ${totalTokens} tokens created. Verdict: ${verdict}.`;

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

  return {
    title: `Deployer Scan: ${truncated}`,
    description: `Check this Solana token deployer's rug history, death rate, funding cluster, and reputation score on DaybreakScan.`,
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

function StructuredData({ address, data }) {
  if (!data) return null;

  const score = data.deployer?.reputation_score ?? 0;
  const verdict = data.verdict || 'UNKNOWN';
  const symbol = data.token?.symbol || '';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'DaybreakScan',
    applicationCategory: 'FinanceApplication',
    url: `https://www.daybreakscan.com/scan/${address}`,
    review: {
      '@type': 'Review',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: score,
        bestRating: 100,
        worstRating: 0,
      },
      name: `$${symbol} Deployer: ${verdict}`,
      reviewBody: `Deployer reputation score: ${score}/100. Verdict: ${verdict}.`,
      author: {
        '@type': 'Organization',
        name: 'DaybreakScan',
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default async function ScanAddressPage({ params }) {
  const { address } = await params;
  const data = await fetchScanData(address);

  return (
    <>
      <StructuredData address={address} data={data} />
      <ScannerClient initialAddress={address} />
    </>
  );
}
