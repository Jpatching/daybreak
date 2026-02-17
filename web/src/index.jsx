import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import ScannerPage from './pages/ScannerPage';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/scan" element={<ScannerPage />} />
        <Route path="/scan/:address" element={<ScannerPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
