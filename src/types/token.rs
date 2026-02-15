use serde::{Deserialize, Serialize};

/// Supported EVM chains
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Chain {
    Ethereum,
    Polygon,
    Arbitrum,
    Optimism,
    Base,
    Avalanche,
    Bsc,
}

impl Chain {
    /// Returns a default public RPC endpoint (rate-limited, for demo purposes)
    pub fn default_rpc_url(&self) -> &'static str {
        match self {
            Chain::Ethereum => "https://ethereum-rpc.publicnode.com",
            Chain::Polygon => "https://polygon-bor-rpc.publicnode.com",
            Chain::Arbitrum => "https://arbitrum-one-rpc.publicnode.com",
            Chain::Optimism => "https://optimism-rpc.publicnode.com",
            Chain::Base => "https://base-rpc.publicnode.com",
            Chain::Avalanche => "https://avalanche-c-chain-rpc.publicnode.com",
            Chain::Bsc => "https://bsc-rpc.publicnode.com",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Chain::Ethereum => "Ethereum",
            Chain::Polygon => "Polygon",
            Chain::Arbitrum => "Arbitrum",
            Chain::Optimism => "Optimism",
            Chain::Base => "Base",
            Chain::Avalanche => "Avalanche",
            Chain::Bsc => "BSC",
        }
    }
}

impl std::fmt::Display for Chain {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.display_name())
    }
}

impl std::str::FromStr for Chain {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "ethereum" | "eth" => Ok(Chain::Ethereum),
            "polygon" | "matic" => Ok(Chain::Polygon),
            "arbitrum" | "arb" => Ok(Chain::Arbitrum),
            "optimism" | "op" => Ok(Chain::Optimism),
            "base" => Ok(Chain::Base),
            "avalanche" | "avax" => Ok(Chain::Avalanche),
            "bsc" | "bnb" => Ok(Chain::Bsc),
            _ => anyhow::bail!("Unknown chain: {}", s),
        }
    }
}

/// Basic ERC-20 token information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenInfo {
    pub address: String,
    pub chain: Chain,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub total_supply: String,
}

/// Detected token capabilities based on function selectors
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TokenCapabilities {
    pub has_mint: bool,
    pub has_burn: bool,
    pub has_pause: bool,
    pub has_blacklist: bool,
    pub has_permit: bool,
    pub is_upgradeable: bool,
    pub is_rebasing: bool,
}
