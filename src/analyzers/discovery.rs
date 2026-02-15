use anyhow::Result;
use reqwest::Client;
use serde::Deserialize;
use std::time::Duration;

/// A discovered token candidate for migration
#[derive(Debug, Clone)]
pub struct DiscoveredToken {
    pub symbol: String,
    #[allow(dead_code)]
    pub name: String,
    pub address: String,
    pub market_cap_rank: Option<u32>,
}

/// CoinGecko market response item
#[derive(Deserialize)]
struct CoinGeckoMarketItem {
    id: String,
    symbol: String,
    name: String,
    market_cap_rank: Option<u32>,
}

/// CoinGecko coin detail (for contract address)
#[derive(Deserialize)]
struct CoinGeckoDetail {
    platforms: std::collections::HashMap<String, Option<String>>,
}

/// Discovers ERC-20 migration candidates dynamically
pub struct TokenDiscovery {
    client: Client,
}

impl TokenDiscovery {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(15))
                .build()
                .unwrap_or_default(),
        }
    }

    /// Discover top ERC-20 tokens, falling back to curated list
    pub async fn discover(&self, limit: usize) -> Vec<DiscoveredToken> {
        match self.discover_from_api(limit).await {
            Ok(tokens) if !tokens.is_empty() => tokens,
            _ => self.curated_fallback(limit),
        }
    }

    /// Try to discover tokens from CoinGecko API
    async fn discover_from_api(&self, limit: usize) -> Result<Vec<DiscoveredToken>> {
        // Fetch top ERC-20 tokens by market cap
        let url = format!(
            "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=ethereum-ecosystem&order=market_cap_desc&per_page={}&page=1",
            limit.min(100)
        );

        let resp = self
            .client
            .get(&url)
            .header("Accept", "application/json")
            .send()
            .await?;

        if !resp.status().is_success() {
            anyhow::bail!("CoinGecko API returned {}", resp.status());
        }

        let items: Vec<CoinGeckoMarketItem> = resp.json().await?;

        // For each token, try to get the Ethereum contract address
        let mut tokens = Vec::new();
        for item in items.iter().take(limit) {
            if let Ok(Some(address)) = self.get_eth_address(&item.id).await {
                tokens.push(DiscoveredToken {
                    symbol: item.symbol.to_uppercase(),
                    name: item.name.clone(),
                    address,
                    market_cap_rank: item.market_cap_rank,
                });
            }
            // Brief pause to respect CoinGecko rate limits
            tokio::time::sleep(Duration::from_millis(250)).await;
        }

        Ok(tokens)
    }

    /// Get Ethereum contract address for a CoinGecko coin
    async fn get_eth_address(&self, coin_id: &str) -> Result<Option<String>> {
        let url = format!(
            "https://api.coingecko.com/api/v3/coins/{}?localization=false&tickers=false&community_data=false&developer_data=false",
            coin_id
        );

        let resp = self
            .client
            .get(&url)
            .header("Accept", "application/json")
            .send()
            .await?;

        if !resp.status().is_success() {
            return Ok(None);
        }

        let detail: CoinGeckoDetail = resp.json().await?;
        Ok(detail
            .platforms
            .get("ethereum")
            .and_then(|v| v.clone())
            .filter(|addr| addr.starts_with("0x") && addr.len() == 42))
    }

    /// Curated list of high-value ERC-20 migration candidates
    pub fn curated_fallback(&self, limit: usize) -> Vec<DiscoveredToken> {
        let curated = vec![
            (
                "ONDO",
                "Ondo Finance",
                "0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3",
            ),
            ("AAVE", "Aave", "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"),
            (
                "UNI",
                "Uniswap",
                "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
            ),
            (
                "LINK",
                "Chainlink",
                "0x514910771AF9Ca656af840dff83E8264EcF986CA",
            ),
            ("MKR", "Maker", "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2"),
            (
                "LDO",
                "Lido DAO",
                "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32",
            ),
            (
                "CRV",
                "Curve DAO",
                "0xD533a949740bb3306d119CC777fa900bA034cd52",
            ),
            (
                "APE",
                "ApeCoin",
                "0x4d224452801ACEd8B2F0aebE155379bb5D594381",
            ),
            (
                "COMP",
                "Compound",
                "0xc00e94Cb662C3520282E6f5717214004A7f26888",
            ),
            (
                "SNX",
                "Synthetix",
                "0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F",
            ),
            (
                "ENS",
                "Ethereum Name Service",
                "0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72",
            ),
            ("DYDX", "dYdX", "0x92D6C1e31e14520e676a687F0a93788B716BEff5"),
            (
                "PENDLE",
                "Pendle",
                "0x808507121B80c02388fAd14726482e061B8da827",
            ),
            (
                "RPL",
                "Rocket Pool",
                "0xD33526068D116cE69F19A9ee46F0bd304F21A51f",
            ),
            (
                "FXS",
                "Frax Share",
                "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0",
            ),
            (
                "BAL",
                "Balancer",
                "0xba100000625a3754423978a60c9317c58a424e3D",
            ),
            (
                "GRT",
                "The Graph",
                "0xc944E90C64B2c07662A292be6244BDf05Cda44a7",
            ),
            (
                "1INCH",
                "1inch",
                "0x111111111117dC0aa78b770fA6A738034120C302",
            ),
            (
                "SUSHI",
                "SushiSwap",
                "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2",
            ),
            (
                "YFI",
                "yearn.finance",
                "0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e",
            ),
            ("ANKR", "Ankr", "0x8290333ceF9e6D528dD5618Fb97a76f268f3EDD4"),
            ("BLUR", "Blur", "0x5283D291DBCF85356A21bA090E6db59121208b44"),
            (
                "CVX",
                "Convex Finance",
                "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B",
            ),
            (
                "LQTY",
                "Liquity",
                "0x6DEA81C8171D0bA574754EF6F8b412F2Ed88c54D",
            ),
            (
                "CELR",
                "Celer Network",
                "0x4F9254C83EB525f9FCf346490bbb3ed28a81C667",
            ),
            (
                "MASK",
                "Mask Network",
                "0x69af81e73A73B40adF4f3d4223Cd9b1ECE623074",
            ),
            (
                "BAND",
                "Band Protocol",
                "0xBA11D00c5f74255f56a5E366F4F77f5A186d7f55",
            ),
            (
                "AUDIO",
                "Audius",
                "0x18aAA7115705e8be94bfFEBDE57Af9BFc265B998",
            ),
            (
                "NMR",
                "Numeraire",
                "0x1776e1F26f98b1A5dF9cD347953a26dd3Cb46671",
            ),
            (
                "PERP",
                "Perpetual Protocol",
                "0xbC396689893D065F41bc2C6EcbeE5e0085233447",
            ),
            (
                "SPELL",
                "Spell Token",
                "0x090185f2135308BaD17527004364eBcC2D37e5F6",
            ),
            (
                "ALCX",
                "Alchemix",
                "0xdBdb4d16EdA451D0503b854CF79D55697F90c8DF",
            ),
            ("REN", "Ren", "0x408e41876cCCDC0F92210600ef50372656052a38"),
            (
                "BADGER",
                "Badger DAO",
                "0x3472A5A71965499acd81997a54BBA8D852C6E53d",
            ),
            (
                "MPL",
                "Maple Finance",
                "0x33349B282065b0284d756F0577FB39c158F935e6",
            ),
            (
                "POND",
                "Marlin",
                "0x57B946008913B82E4dF85f501cbAeD910e58D26C",
            ),
            (
                "TRIBE",
                "Tribe",
                "0xc7283b66Eb1EB5FB86327f08e1B5816b0720212B",
            ),
            (
                "LOOKS",
                "LooksRare",
                "0xf4d2888d29D722226FafA5d9B24F9164c092421E",
            ),
            (
                "HIGH",
                "Highstreet",
                "0x71Ab77b7dbB4fa7e017BC15090b2163221420282",
            ),
            (
                "AURA",
                "Aura Finance",
                "0xC0c293ce456fF0ED870ADd98a0828Dd4d2903DBF",
            ),
            // Already on Solana — included for contrast
            (
                "USDC",
                "USD Coin",
                "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            ),
            (
                "USDT",
                "Tether",
                "0xdAC17F958D2ee523a2206206994597C13D831ec7",
            ),
            ("DAI", "Dai", "0x6B175474E89094C44Da98b954EedeAC495271d0F"),
            (
                "WETH",
                "Wrapped Ether",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
            ),
            (
                "WBTC",
                "Wrapped Bitcoin",
                "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
            ),
        ];

        curated
            .into_iter()
            .take(limit)
            .enumerate()
            .map(|(i, (symbol, name, address))| DiscoveredToken {
                symbol: symbol.to_string(),
                name: name.to_string(),
                address: address.to_string(),
                market_cap_rank: Some(i as u32 + 1),
            })
            .collect()
    }
}

impl Default for TokenDiscovery {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_curated_fallback_returns_tokens() {
        let discovery = TokenDiscovery::new();
        let tokens = discovery.curated_fallback(10);
        assert_eq!(tokens.len(), 10);
    }

    #[test]
    fn test_curated_fallback_limit() {
        let discovery = TokenDiscovery::new();
        let tokens = discovery.curated_fallback(3);
        assert_eq!(tokens.len(), 3);
    }

    #[test]
    fn test_curated_fallback_ondo_first() {
        let discovery = TokenDiscovery::new();
        let tokens = discovery.curated_fallback(1);
        assert_eq!(tokens[0].symbol, "ONDO");
        assert_eq!(
            tokens[0].address,
            "0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3"
        );
    }

    #[test]
    fn test_curated_fallback_has_valid_addresses() {
        let discovery = TokenDiscovery::new();
        let tokens = discovery.curated_fallback(45);
        for token in &tokens {
            assert!(
                token.address.starts_with("0x"),
                "{} address should start with 0x",
                token.symbol
            );
            assert_eq!(
                token.address.len(),
                42,
                "{} address should be 42 chars",
                token.symbol
            );
        }
    }

    #[test]
    fn test_curated_includes_solana_contrast_tokens() {
        let discovery = TokenDiscovery::new();
        let tokens = discovery.curated_fallback(45);
        let symbols: Vec<&str> = tokens.iter().map(|t| t.symbol.as_str()).collect();
        assert!(symbols.contains(&"USDC"));
        assert!(symbols.contains(&"USDT"));
        assert!(symbols.contains(&"WBTC"));
    }

    #[test]
    fn test_curated_large_limit() {
        let discovery = TokenDiscovery::new();
        let tokens = discovery.curated_fallback(1000);
        // Should return at most the number of curated tokens, not panic
        assert!(tokens.len() <= 50);
        assert!(tokens.len() > 40);
    }
}
