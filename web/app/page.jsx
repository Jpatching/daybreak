import LandingContent from '@/components/LandingContent';

export const metadata = {
  title: 'DaybreakScan — Solana Deployer Reputation Scanner | Check Rug Pull History',
  description:
    "Check any Solana token deployer's rug history before you trade. Scan wallet reputation, death rates, funding clusters, and risk scores instantly. Free Pump.fun safety checks.",
  alternates: { canonical: '/' },
  openGraph: {
    title: 'DaybreakScan — Solana Deployer Reputation Scanner | Check Rug Pull History',
    description:
      "Scan any Solana deployer's rug rate, funding cluster, and risk score. The deployer check that token scanners miss.",
    url: '/',
    images: ['/daybreak-logo.png'],
  },
  twitter: {
    title: 'DaybreakScan — Solana Deployer Reputation Scanner',
    description:
      "Scan any Solana deployer's rug rate, funding cluster, and risk score. The deployer check that token scanners miss.",
    images: ['/daybreak-logo.png'],
  },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'DaybreakScan',
            description:
              "Solana deployer reputation scanner — check any token deployer's rug history, death rate, funding clusters, and risk score before you trade.",
            url: 'https://www.daybreakscan.com',
            applicationCategory: 'FinanceApplication',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            author: {
              '@type': 'Organization',
              name: 'Daybreak',
              url: 'https://github.com/Jpatching/daybreak',
            },
          }),
        }}
      />
      <LandingContent />
    </>
  );
}
