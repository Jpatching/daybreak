import { Inter, JetBrains_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import WalletProvider from '@/components/WalletProvider';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import '@/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
});

export const metadata = {
  metadataBase: new URL('https://www.daybreakscan.com'),
  title: {
    default: 'DaybreakScan — Solana Deployer Reputation Scanner | Check Rug Pull History',
    template: '%s | DaybreakScan',
  },
  description:
    "Check any Solana token deployer's rug history before you trade. Scan wallet reputation, death rates, funding clusters, and risk scores instantly.",
  openGraph: {
    type: 'website',
    siteName: 'DaybreakScan',
    title: 'DaybreakScan — Solana Deployer Reputation Scanner',
    description:
      "Scan any Solana deployer's rug rate, funding cluster, and risk score. The deployer check that token scanners miss.",
    images: [{ url: '/og', width: 1200, height: 630, alt: 'DaybreakScan — Solana Deployer Reputation Scanner' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DaybreakScan — Solana Deployer Reputation Scanner',
    description:
      "Scan any Solana deployer's rug rate, funding cluster, and risk score. The deployer check that token scanners miss.",
    images: [{ url: '/og', width: 1200, height: 630, alt: 'DaybreakScan — Solana Deployer Reputation Scanner' }],
  },
  robots: { index: true, follow: true },
  icons: { icon: '/daybreak-logo-square.png' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <head>
        <link rel="preconnect" href="https://api.daybreakscan.com" />
        <link rel="dns-prefetch" href="https://api.daybreakscan.com" />
      </head>
      <body className="font-sans antialiased bg-slate-900">
        <WalletProvider>
          <Nav />
          {children}
          <Footer />
        </WalletProvider>
        <Analytics />
      </body>
    </html>
  );
}
