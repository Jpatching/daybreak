import { Router, Request, Response } from 'express';
import { healthCheck } from '../services/helius';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const heliusOk = await healthCheck();
  res.json({
    status: 'ok',
    helius: heliusOk,
    version: '1.0.0',
  });
});

export default router;
