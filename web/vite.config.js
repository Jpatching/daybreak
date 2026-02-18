import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'wallet': [
            '@solana/wallet-adapter-react',
            '@solana/wallet-adapter-base',
            '@solana/wallet-adapter-phantom',
            '@solana/wallet-adapter-solflare',
            '@solana/wallet-adapter-react-ui',
          ],
          'solana': ['@solana/web3.js'],
        },
      },
    },
  },
  server: { port: 5173, open: true },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/__tests__/**/*.test.{js,jsx}'],
    setupFiles: ['src/__tests__/setup.js'],
  },
});
