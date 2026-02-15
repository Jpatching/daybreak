use crate::types::{Chain, HolderData, HolderInfo};
use anyhow::{Context, Result};
use reqwest::Client;
use serde::Deserialize;

/// Fetches holder data from block explorers
pub struct HolderAnalyzer {
    client: Client,
    api_key: Option<String>,
}

#[derive(Deserialize)]
struct EtherscanResponse {
    status: String,
    result: serde_json::Value,
}

#[derive(Deserialize)]
struct EtherscanHolder {
    #[serde(rename = "TokenHolderAddress")]
    address: String,
    #[serde(rename = "TokenHolderQuantity")]
    balance: String,
}

impl HolderAnalyzer {
    pub fn new(api_key: Option<String>) -> Self {
        Self {
            client: Client::new(),
            api_key,
        }
    }

    /// Fetch top holders for a token
    pub async fn get_holders(&self, address: &str, chain: Chain) -> Result<HolderData> {
        let api_key = self
            .api_key
            .as_ref()
            .context("Etherscan API key required for holder data")?;

        let base_url = Self::get_api_url(chain)?;
        let url = format!(
            "{}?module=token&action=tokenholderlist&contractaddress={}&page=1&offset=10&apikey={}",
            base_url, address, api_key
        );

        let response: EtherscanResponse = self
            .client
            .get(&url)
            .send()
            .await
            .context("Failed to fetch holder data")?
            .json()
            .await
            .context("Failed to parse holder response")?;

        if response.status != "1" {
            anyhow::bail!(
                "Etherscan API error: {}",
                response.result.as_str().unwrap_or("Unknown error")
            );
        }

        let holders: Vec<EtherscanHolder> =
            serde_json::from_value(response.result).context("Failed to parse holder list")?;

        self.calculate_concentration(holders).await
    }

    /// Calculate holder concentration from raw data
    async fn calculate_concentration(&self, holders: Vec<EtherscanHolder>) -> Result<HolderData> {
        // Parse balances and calculate percentages
        let mut top_holders: Vec<HolderInfo> = Vec::new();
        let mut total_balance: f64 = 0.0;

        for holder in &holders {
            let balance: f64 = holder.balance.parse().unwrap_or(0.0);
            total_balance += balance;
        }

        for holder in holders {
            let balance: f64 = holder.balance.parse().unwrap_or(0.0);
            let percentage = if total_balance > 0.0 {
                (balance / total_balance) * 100.0
            } else {
                0.0
            };

            top_holders.push(HolderInfo {
                address: holder.address,
                balance: holder.balance,
                percentage,
            });
        }

        let top_10_concentration: f64 = top_holders.iter().map(|h| h.percentage).sum();

        Ok(HolderData {
            top_holders,
            top_10_concentration,
            total_holders: None, // Would require separate API call
        })
    }

    /// Get the appropriate API URL for the chain
    fn get_api_url(chain: Chain) -> Result<&'static str> {
        match chain {
            Chain::Ethereum => Ok("https://api.etherscan.io/api"),
            Chain::Polygon => Ok("https://api.polygonscan.com/api"),
            Chain::Arbitrum => Ok("https://api.arbiscan.io/api"),
            Chain::Optimism => Ok("https://api-optimistic.etherscan.io/api"),
            Chain::Base => Ok("https://api.basescan.org/api"),
            Chain::Bsc => Ok("https://api.bscscan.com/api"),
            Chain::Avalanche => Ok("https://api.snowtrace.io/api"),
        }
    }
}
