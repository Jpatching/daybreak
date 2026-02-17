import { Router } from 'express';
import { generateNonce, verifyWalletSignature, issueToken } from '../services/auth';
import { isValidSolanaAddress } from '../utils/validate';

const router = Router();

/** GET /api/v1/auth/nonce?wallet=<address> — get a challenge nonce */
router.get('/nonce', (req, res) => {
  const wallet = req.query.wallet as string;
  if (!wallet || !isValidSolanaAddress(wallet)) {
    return res.status(400).json({ error: 'Valid Solana wallet address required' });
  }

  const nonce = generateNonce(wallet);
  res.json({ nonce });
});

/** POST /api/v1/auth/verify — verify signed nonce and get JWT */
router.post('/verify', (req, res) => {
  const { wallet, signature, message } = req.body;

  if (!wallet || !signature || !message) {
    return res.status(400).json({ error: 'wallet, signature, and message required' });
  }

  if (!isValidSolanaAddress(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  const valid = verifyWalletSignature(wallet, signature, message);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const token = issueToken(wallet);
  res.json({ token });
});

export default router;
