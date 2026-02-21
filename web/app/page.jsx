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
    images: [{ url: '/og', width: 1200, height: 630, alt: 'DaybreakScan — Solana Deployer Reputation Scanner' }],
  },
  twitter: {
    title: 'DaybreakScan — Solana Deployer Reputation Scanner',
    description:
      "Scan any Solana deployer's rug rate, funding cluster, and risk score. The deployer check that token scanners miss.",
    images: [{ url: '/og', width: 1200, height: 630, alt: 'DaybreakScan — Solana Deployer Reputation Scanner' }],
  },
};

// Static FAQ data — used for both the schema markup and the LandingContent component
const faqData = [
  {
    question: 'What does DaybreakScan do?',
    answer: "DaybreakScan scans any Solana token address and analyzes the deployer's on-chain history. It calculates a reputation score based on how many tokens they've created, how many are dead (rugged), and their funding network.",
  },
  {
    question: 'How does rug detection work?',
    answer: "We check each of the deployer's tokens against DexScreener for liquidity. Tokens with less than $100 liquidity and no 24h volume are classified as dead. The death rate is dead tokens / total tokens.",
  },
  {
    question: 'What is a reputation score?',
    answer: 'A Bayesian 0-100 composite score. It weighs death rate (40%), token count penalty (20%), average token lifespan (20%), and cluster connections (20%). Additional penalties for active mint/freeze authority, bundled launches, and concentrated holdings. Higher is better: 70+ is CLEAN, below 30 is SERIAL_RUGGER.',
  },
  {
    question: 'What is cluster analysis?',
    answer: "We trace who funded the deployer's wallet, then check if that funder also funded other Pump.fun deployers. This reveals rug networks where one entity controls many deployer wallets.",
  },
  {
    question: 'Why do I need to connect my wallet?',
    answer: 'Wallet authentication protects our Helius API credits. Each scan costs 50-100 API calls. You sign a message to prove wallet ownership — no transactions, no seed phrases, no funds at risk. You get 1 free scan without connecting, or 3/day with a wallet.',
  },
  {
    question: 'What are the scan limits?',
    answer: '1 free scan without a wallet. Connect your Solana wallet for 3 free scans per day. Need more? Pay $0.01 USDC per scan via x402 protocol — no subscription, no signup.',
  },
  {
    question: 'Is DaybreakScan open source?',
    answer: 'Yes. MIT license. The full backend, frontend, and MCP server are on GitHub. Verify every line of the scoring algorithm yourself.',
  },
];

// FAQ schema JSON-LD — all content is static/hardcoded, no user input
const faqSchema = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqData.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
});

// WebApplication schema JSON-LD — all content is static/hardcoded, no user input
const appSchema = JSON.stringify({
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
});

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: appSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqSchema }} />
      <LandingContent />
    </>
  );
}
