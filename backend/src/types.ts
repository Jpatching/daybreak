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
  price_usd: number | null;
  price_change_24h: number | null;
  volume_24h: number | null;
  fdv: number | null;
  created_at: string | null;
  dexscreener_url: string;
}

export interface DeployerInfo {
  wallet: string;
  sol_balance: number | null;
  tokens_created: number;
  tokens_dead: number;
  tokens_unverified: number;
  tokens_assumed_dead: number;
  rug_rate: number;
  death_rate: number;
  reputation_score: number;
  deploy_velocity: number | null;
  deployer_is_burner: boolean;
  first_seen: string | null;
  last_seen: string | null;
  tokens: DeployerToken[];
}

export interface FundingInfo {
  source_wallet: string | null;
  other_deployers_funded: number;
  cluster_total_tokens: number;
  cluster_total_dead: number;
  from_cex: boolean;
  cex_name: string | null;
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
  tokens_may_be_incomplete: boolean;
}

export interface TokenRisks {
  mint_authority: string | null;
  freeze_authority: string | null;
  deployer_holdings_pct: number | null;
  top_holder_pct: number | null;
  bundle_detected: boolean | null;
  lp_locked: boolean | null;
  lp_lock_pct: number | null;
}

export interface TokenMarketData {
  price_usd: number | null;
  price_change_24h: number | null;
  volume_24h: number | null;
  fdv: number | null;
  market_cap: number | null;
  socials: TokenSocials | null;
}

export interface TokenSocials {
  website: string | null;
  twitter: string | null;
  telegram: string | null;
}

export interface RugCheckResult {
  risk_level: string | null;
  risk_score: number | null;
  risks: RugCheckRisk[];
  lp_locked: boolean;
  lp_lock_pct: number;
}

export interface RugCheckRisk {
  name: string;
  level: string;
  description: string;
  score: number;
}

export interface ScanUsage {
  scans_used: number;
  scans_limit: number;
  scans_remaining: number;
}

export interface ScoreBreakdown {
  rug_rate_component: number;
  token_count_component: number;
  lifespan_component: number;
  cluster_component: number;
  risk_deductions: number;
  details: string[];
}

export interface DeployerScan {
  token: TokenInfo;
  deployer: DeployerInfo;
  funding: FundingInfo;
  verdict: Verdict;
  score_breakdown: ScoreBreakdown;
  token_risks: TokenRisks | null;
  market_data: TokenMarketData | null;
  rugcheck: RugCheckResult | null;
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
  priceUsd?: string;
  priceChange?: {
    h24?: number;
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: {
    websites?: Array<{ url: string }>;
    socials?: Array<{ type: string; url: string }>;
  };
}

export interface FindDeployerResult {
  wallet: string;
  creationSig: string | null;
  method: 'enhanced_api' | 'rpc_fallback';
}

// PumpPortal real-time events
export interface PumpPortalNewToken {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  traderPublicKey: string;
  initialBuy: number;
  bondingCurveKey: string;
  vTokensInBondingCurve: number;
  vSolInBondingCurve: number;
  marketCapSol: number;
  timestamp: number;
}

export interface PumpPortalMigration {
  mint: string;
  pool: string;
  timestamp: number;
}
