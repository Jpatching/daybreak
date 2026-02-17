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
}

export interface DeployerInfo {
  wallet: string;
  tokens_created: number;
  tokens_dead: number;
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

export interface DeployerScan {
  token: TokenInfo;
  deployer: DeployerInfo;
  funding: FundingInfo;
  verdict: Verdict;
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
