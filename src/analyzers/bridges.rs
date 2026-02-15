use crate::types::{BridgeStatus, BridgeType, Chain};
use anyhow::Result;
use reqwest::Client;
use serde::Deserialize;
use std::time::Duration;

/// Detects existing bridges for a token using live APIs + curated fallback
pub struct BridgeDetector {
    client: Client,
}

/// Wormhole chain IDs
fn wormhole_chain_id(chain: Chain) -> u16 {
    match chain {
        Chain::Ethereum => 2,
        Chain::Polygon => 5,
        Chain::Arbitrum => 23,
        Chain::Optimism => 24,
        Chain::Base => 30,
        Chain::Avalanche => 6,
        Chain::Bsc => 4,
    }
}

/// Response from WormholeScan operations API
#[derive(Deserialize)]
struct WormholeOperationsResponse {
    operations: Option<Vec<serde_json::Value>>,
}

/// A curated bridge entry with type annotation
struct KnownBridge {
    evm_address: &'static str,
    solana_address: &'static str,
    symbol: &'static str,
    #[allow(dead_code)]
    bridge_type: BridgeType,
}

/// Tokens natively issued on Solana (not bridged)
const KNOWN_NATIVE: &[KnownBridge] = &[
    KnownBridge {
        evm_address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        solana_address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        symbol: "USDC",
        bridge_type: BridgeType::Native,
    },
    KnownBridge {
        evm_address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
        solana_address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        symbol: "USDT",
        bridge_type: BridgeType::Native,
    },
];

/// Tokens bridged via Wormhole Portal (wrapped/synthetic)
const KNOWN_PORTAL: &[KnownBridge] = &[
    KnownBridge {
        evm_address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
        solana_address: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
        symbol: "WBTC",
        bridge_type: BridgeType::Portal,
    },
    KnownBridge {
        evm_address: "0x6b175474e89094c44da98b954eedeac495271d0f",
        solana_address: "EjmyN6qEC1Tf1JxiG1ae7UTJhUxSwk1TCCb39Aqc1ckQ",
        symbol: "DAI",
        bridge_type: BridgeType::Portal,
    },
    KnownBridge {
        evm_address: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
        solana_address: "8FU95xFJhUUkyyCLU13HSzDLs7oC4QZdXQHL6SCeab36",
        symbol: "UNI",
        bridge_type: BridgeType::Portal,
    },
    KnownBridge {
        evm_address: "0x514910771af9ca656af840dff83e8264ecf986ca",
        solana_address: "2wpTofQ8SkACrkZWrZDjRPy2NJkbDHTeFERNQA5Kk7HR",
        symbol: "LINK",
        bridge_type: BridgeType::Portal,
    },
    KnownBridge {
        evm_address: "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9",
        solana_address: "AqEHVh8J2nXH9saV2ciZyYwPpqWFRfD2ffcq5Z8MotzR",
        symbol: "AAVE",
        bridge_type: BridgeType::Portal,
    },
    KnownBridge {
        evm_address: "0xc944e90c64b2c07662a292be6244bdf05cda44a7",
        solana_address: "5SFXtVHZx7gNozADqecUCBbCFiTVcSRaUKJirVXwKiR6",
        symbol: "GRT",
        bridge_type: BridgeType::Portal,
    },
    KnownBridge {
        evm_address: "0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f",
        solana_address: "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj",
        symbol: "SNX",
        bridge_type: BridgeType::Portal,
    },
    KnownBridge {
        evm_address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        solana_address: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
        symbol: "WETH",
        bridge_type: BridgeType::Portal,
    },
];

/// Tokens bridged via NTT/Sunrise (native SPL)
const KNOWN_NTT: &[KnownBridge] = &[
    // W token — Wormhole's own token via NTT
    KnownBridge {
        evm_address: "0xb0ffa8000886e57f86dd5264b9582b2ad87b2b91",
        solana_address: "85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ",
        symbol: "W",
        bridge_type: BridgeType::Ntt,
    },
];

impl BridgeDetector {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .unwrap_or_default(),
        }
    }

    /// Check if token already exists on Solana via various bridges.
    /// Uses live WormholeScan API queries supplemented by a curated fallback list.
    pub async fn check(&self, address: &str, chain: Chain) -> Result<BridgeStatus> {
        let address_lower = address.to_lowercase();

        // 1. Check curated lists first (fast, reliable, typed)
        if let Some(status) = self.check_curated(&address_lower) {
            return Ok(status);
        }

        // 2. Query WormholeScan API for Wormhole attestation/activity
        let wormhole_attested = self
            .check_wormhole_api(&address_lower, chain)
            .await
            .unwrap_or(false);

        Ok(BridgeStatus {
            already_on_solana: false,
            solana_address: None,
            bridge_provider: None,
            bridge_type: None,
            wormhole_attested,
        })
    }

    /// Check curated lists of known bridged tokens (NTT > Native > Portal)
    fn check_curated(&self, address: &str) -> Option<BridgeStatus> {
        // Check NTT tokens first — these are the Sunrise value prop
        for entry in KNOWN_NTT {
            if address == entry.evm_address {
                return Some(BridgeStatus {
                    already_on_solana: true,
                    solana_address: Some(entry.solana_address.to_string()),
                    bridge_provider: Some(format!("NTT/Sunrise ({})", entry.symbol)),
                    bridge_type: Some(BridgeType::Ntt),
                    wormhole_attested: true,
                });
            }
        }

        // Check native tokens
        for entry in KNOWN_NATIVE {
            if address == entry.evm_address {
                return Some(BridgeStatus {
                    already_on_solana: true,
                    solana_address: Some(entry.solana_address.to_string()),
                    bridge_provider: Some(format!("Native ({})", entry.symbol)),
                    bridge_type: Some(BridgeType::Native),
                    wormhole_attested: false,
                });
            }
        }

        // Check Portal (wrapped) tokens
        for entry in KNOWN_PORTAL {
            if address == entry.evm_address {
                return Some(BridgeStatus {
                    already_on_solana: true,
                    solana_address: Some(entry.solana_address.to_string()),
                    bridge_provider: Some(format!("Wormhole Portal ({})", entry.symbol)),
                    bridge_type: Some(BridgeType::Portal),
                    wormhole_attested: true,
                });
            }
        }

        None
    }

    /// Query WormholeScan API for cross-chain activity involving this token
    async fn check_wormhole_api(&self, address: &str, chain: Chain) -> Result<bool> {
        let chain_id = wormhole_chain_id(chain);
        let url = format!(
            "https://api.wormholescan.io/api/v1/operations?address={}&sourceChain={}&limit=1",
            address, chain_id
        );

        let resp = self
            .client
            .get(&url)
            .timeout(Duration::from_secs(5))
            .send()
            .await?;

        if !resp.status().is_success() {
            return Ok(false);
        }

        let body: WormholeOperationsResponse = resp.json().await?;
        Ok(body.operations.map(|ops| !ops.is_empty()).unwrap_or(false))
    }
}

impl Default for BridgeDetector {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_curated_native_usdc() {
        let detector = BridgeDetector::new();
        let result = detector.check_curated("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
        let status = result.expect("USDC should be in curated list");
        assert!(status.already_on_solana);
        assert_eq!(
            status.solana_address.as_deref(),
            Some("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
        );
        assert_eq!(status.bridge_type, Some(BridgeType::Native));
    }

    #[test]
    fn test_curated_portal_wbtc() {
        let detector = BridgeDetector::new();
        let result = detector.check_curated("0x2260fac5e5542a773aa44fbcfedf7c193bc2c599");
        let status = result.expect("WBTC should be in curated list");
        assert!(status.already_on_solana);
        assert_eq!(status.bridge_type, Some(BridgeType::Portal));
        assert!(status.wormhole_attested);
    }

    #[test]
    fn test_curated_ntt_w_token() {
        let detector = BridgeDetector::new();
        let result = detector.check_curated("0xb0ffa8000886e57f86dd5264b9582b2ad87b2b91");
        let status = result.expect("W token should be in curated list");
        assert!(status.already_on_solana);
        assert_eq!(status.bridge_type, Some(BridgeType::Ntt));
    }

    #[test]
    fn test_curated_unknown_token() {
        let detector = BridgeDetector::new();
        let result = detector.check_curated("0x0000000000000000000000000000000000000000");
        assert!(result.is_none());
    }

    #[test]
    fn test_curated_case_insensitive() {
        let detector = BridgeDetector::new();
        // The curated list uses lowercase, so uppercase input should NOT match
        // (check() lowercases before calling check_curated)
        let result = detector.check_curated("0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48");
        assert!(result.is_none());
    }

    #[test]
    fn test_wormhole_chain_ids() {
        assert_eq!(wormhole_chain_id(Chain::Ethereum), 2);
        assert_eq!(wormhole_chain_id(Chain::Polygon), 5);
        assert_eq!(wormhole_chain_id(Chain::Bsc), 4);
        assert_eq!(wormhole_chain_id(Chain::Arbitrum), 23);
        assert_eq!(wormhole_chain_id(Chain::Base), 30);
    }

    #[tokio::test]
    async fn test_check_lowercases_address() {
        let detector = BridgeDetector::new();
        // USDC with mixed case should still be found
        let result = detector
            .check(
                "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                Chain::Ethereum,
            )
            .await
            .unwrap();
        assert!(result.already_on_solana);
        assert_eq!(result.bridge_type, Some(BridgeType::Native));
    }
}
