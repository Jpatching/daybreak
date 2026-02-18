import LandingContent from '@/components/LandingContent';

export const metadata = {
  title: 'Daybreak - Solana Deployer Reputation Scanner',
  description:
    'Check any Solana token deployer\'s reputation before you ape. Rug detection, deployer history, cluster analysis, and funding trace on Solana.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Daybreak - Solana Deployer Reputation Scanner',
    description:
      'Check any deployer\'s reputation. Rug detection and scoring on Solana.',
    url: '/',
    images: ['/daybreak-logo.png'],
  },
  twitter: {
    title: 'Daybreak - Solana Deployer Reputation Scanner',
    description:
      'Check any deployer\'s reputation. Rug detection and scoring on Solana.',
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
            name: 'Daybreak',
            description:
              'Solana deployer reputation scanner — check any token deployer\'s rug history before you ape.',
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
