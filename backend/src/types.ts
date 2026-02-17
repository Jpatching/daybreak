export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
}

export interface DeployerToken {
  address: string;
  name: string;
  symbol: string;
  alive: boolean;
  liquidity: number;
  created_at: string | null;
  dexscreener_url: string;
}

export interface DeployerInfo {
  wallet: string;
  tokens_created: number;
  tokens_dead: number;
  tokens_unverified: number;
  rug_rate: number;
  reputation_score: number;
  first_seen: string | null;
  last_seen: string | null;
  tokens: DeployerToken[];
}

export interface FundingInfo {
  source_wallet: string | null;
  other_deployers_funded: number;
  cluster_total_tokens: number;
  cluster_total_dead: number;
}

export type Verdict = 'CLEAN' | 'SUSPICIOUS' | 'SERIAL_RUGGER';

export interface ScanEvidence {
  deployer_url: string;
  funding_source_url: string | null;
  creation_tx_url: string | null;
}

export interface ScanConfidence {
  tokens_verified: number;
  tokens_unverified: number;
  deployer_method: 'enhanced_api' | 'rpc_fallback';
  cluster_checked: boolean;
  token_risks_checked: boolean;
}

export interface TokenRisks {
  mint_authority: string | null;        // null = revoked (safe)
  freeze_authority: string | null;      // null = revoked (safe)
  deployer_holdings_pct: number | null; // 0-100
  top_holder_pct: number | null;        // 0-100
  bundle_detected: boolean | null;      // true = 3+ buys in creation slot
}

export interface ScanUsage {
  scans_used: number;
  scans_limit: number;
  scans_remaining: number;
}

export interface DeployerScan {
  token: TokenInfo;
  deployer: DeployerInfo;
  funding: FundingInfo;
  verdict: Verdict;
  token_risks: TokenRisks | null;
  evidence: ScanEvidence;
  confidence: ScanConfidence;
  usage: ScanUsage;
  scanned_at: string;
}

export interface HealthResponse {
  status: string;
  helius: boolean;
  version: string;
}

export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  liquidity?: {
    usd: number;
  };
  volume?: {
    h24: number;
  };
  fdv?: number;
  pairCreatedAt?: number;
}

export interface FindDeployerResult {
  wallet: string;
  creationSig: string | null;
  method: 'enhanced_api' | 'rpc_fallback';
}
