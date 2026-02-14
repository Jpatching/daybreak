use anyhow::Result;
use reqwest::Client;
use serde::Deserialize;
use crate::types::{BridgeStatus, Chain};

/// Detects existing bridges for a token
pub struct BridgeDetector {
    client: Client,
}

#[derive(Deserialize)]
struct JupiterToken {
    address: String,
    #[serde(default)]
    extensions: Option<JupiterExtensions>,
}

#[derive(Deserialize)]
struct JupiterExtensions {
    #[serde(rename = "coingeckoId")]
    coingecko_id: Option<String>,
}

impl BridgeDetector {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    /// Check if token already exists on Solana via various bridges
    pub async fn check(&self, address: &str, _chain: Chain) -> Result<BridgeStatus> {
        let address_lower = address.to_lowercase();

        // Check Jupiter token list for known bridged tokens
        let jupiter_result = self.check_jupiter(&address_lower).await;

        // Check Wormhole attestation
        let wormhole_attested = self.check_wormhole(&address_lower).await.unwrap_or(false);

        match jupiter_result {
            Ok(Some((solana_addr, provider))) => Ok(BridgeStatus {
                already_on_solana: true,
                solana_address: Some(solana_addr),
                bridge_provider: Some(provider),
                wormhole_attested,
            }),
            _ => Ok(BridgeStatus {
                already_on_solana: false,
                solana_address: None,
                bridge_provider: None,
                wormhole_attested,
            }),
        }
    }

    /// Check Jupiter token list for this token
    async fn check_jupiter(&self, _evm_address: &str) -> Result<Option<(String, String)>> {
        // Jupiter's full token list is large; for demo purposes we'll check
        // a subset of known bridged tokens
        // In production, this would query the full list or a dedicated API

        // Known major tokens that are already on Solana via various bridges
        let known_bridges = [
            // USDC - native on Solana, also Wormhole wrapped
            (
                "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                "Native",
            ),
            // USDT - Wormhole wrapped
            (
                "0xdac17f958d2ee523a2206206994597c13d831ec7",
                "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
                "Wormhole",
            ),
            // WBTC - Wormhole wrapped
            (
                "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
                "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
                "Wormhole",
            ),
            // DAI - Wormhole wrapped
            (
                "0x6b175474e89094c44da98b954eedeac495271d0f",
                "EjmyN6qEC1Tf1JxiG1ae7UTJhUxSwk1TCCb39Aqc1ckQ",
                "Wormhole",
            ),
        ];

        for (eth_addr, sol_addr, provider) in known_bridges {
            if _evm_address == eth_addr {
                return Ok(Some((sol_addr.to_string(), provider.to_string())));
            }
        }

        Ok(None)
    }

    /// Check Wormhole token attestation
    async fn check_wormhole(&self, address: &str) -> Result<bool> {
        // In production, this would query Wormhole's token bridge registry
        // For demo, check against known Wormhole-attested tokens

        let wormhole_attested = [
            "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
            "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
            "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", // WBTC
            "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
            "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", // UNI
            "0x514910771af9ca656af840dff83e8264ecf986ca", // LINK
        ];

        Ok(wormhole_attested.contains(&address))
    }
}

impl Default for BridgeDetector {
    fn default() -> Self {
        Self::new()
    }
}
