import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import WalletProvider from './components/WalletProvider';
import './styles.css';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const ScannerPage = lazy(() => import('./pages/ScannerPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<WalletProvider><LandingPage /></WalletProvider>} />
          <Route path="/scan" element={<WalletProvider><ScannerPage /></WalletProvider>} />
          <Route path="/scan/:address" element={<WalletProvider><ScannerPage /></WalletProvider>} />
          <Route path="/profile" element={<WalletProvider><ProfilePage /></WalletProvider>} />
        </Routes>
      </Suspense>
    </BrowserRouter>
    <Analytics />
  </React.StrictMode>
);
