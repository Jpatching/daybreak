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
    default: 'Daybreak - Solana Deployer Reputation Scanner',
    template: '%s | DaybreakScan',
  },
  description:
    'Check any Solana token deployer\'s reputation before you ape. Rug detection, deployer history, cluster analysis.',
  openGraph: {
    type: 'website',
    siteName: 'DaybreakScan',
    title: 'Daybreak - Solana Deployer Reputation Scanner',
    description:
      'Check any deployer\'s reputation. Rug detection and scoring on Solana.',
    images: ['/daybreak-logo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Daybreak - Solana Deployer Reputation Scanner',
    description:
      'Check any deployer\'s reputation. Rug detection and scoring on Solana.',
    images: ['/daybreak-logo.png'],
  },
  robots: { index: true, follow: true },
  icons: { icon: '/daybreak-logo-square.png' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
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
