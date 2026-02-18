import ScannerClient from '@/components/ScannerClient';

export const metadata = {
  title: 'Token Scanner',
  description:
    'Scan any Solana token address to check the deployer\'s reputation score, rug rate, and funding cluster.',
  alternates: { canonical: '/scan' },
};

export default function ScanPage() {
  return <ScannerClient />;
}
