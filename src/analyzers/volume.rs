use crate::types::Chain;
use anyhow::{Context, Result};
use reqwest::Client;
use serde::Deserialize;

/// Fetches 24h transfer volume from Etherscan to calculate NTT rate limits
pub struct VolumeAnalyzer {
    client: Client,
    api_key: Option<String>,
}

/// Rate limit recommendation based on on-chain transfer volume
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RateLimitRecommendation {
    /// 24h transfer count from Etherscan
    pub daily_transfers: u64,
    /// Recommended daily inbound limit (tokens)
    pub recommended_daily_limit: u64,
    /// Recommended per-transaction limit (tokens)
    pub recommended_per_tx_limit: u64,
    /// Human-readable reasoning
    pub reasoning: String,
    /// Whether the token has high volatility (needs tighter limits)
    pub high_volume_warning: bool,
}

#[derive(Deserialize)]
struct EtherscanTokenTxResponse {
    status: String,
    result: serde_json::Value,
}

impl VolumeAnalyzer {
    pub fn new(api_key: Option<String>) -> Self {
        Self {
            client: Client::new(),
            api_key,
        }
    }

    /// Fetch recent transfer activity and calculate rate limit recommendations
    pub async fn analyze(
        &self,
        address: &str,
        chain: Chain,
        decimals: u8,
        total_supply_raw: &str,
    ) -> Result<RateLimitRecommendation> {
        let api_key = match &self.api_key {
            Some(key) => key.clone(),
            None => return Ok(Self::fallback_recommendation(decimals, total_supply_raw)),
        };

        let base_url = Self::get_api_url(chain)?;

        // Fetch recent token transfers (last 100 transactions gives us activity level)
        let url = format!(
            "{}?module=account&action=tokentx&contractaddress={}&page=1&offset=100&sort=desc&apikey={}",
            base_url, address, api_key
        );

        let response: EtherscanTokenTxResponse = self
            .client
            .get(&url)
            .send()
            .await
            .context("Failed to fetch token transfers")?
            .json()
            .await
            .context("Failed to parse transfer response")?;

        if response.status != "1" {
            // API error or no transfers — fall back to supply-based estimate
            return Ok(Self::fallback_recommendation(decimals, total_supply_raw));
        }

        let transfers: Vec<serde_json::Value> = match serde_json::from_value(response.result) {
            Ok(t) => t,
            Err(_) => return Ok(Self::fallback_recommendation(decimals, total_supply_raw)),
        };

        if transfers.is_empty() {
            return Ok(Self::fallback_recommendation(decimals, total_supply_raw));
        }

        // Estimate daily volume from the transfer timestamps
        let (daily_transfers, daily_volume) =
            Self::estimate_daily_activity(&transfers, decimals);

        Self::calculate_recommendation(daily_transfers, daily_volume, decimals, total_supply_raw)
    }

    /// Estimate 24h transfer count and volume from recent transactions
    fn estimate_daily_activity(transfers: &[serde_json::Value], decimals: u8) -> (u64, f64) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let one_day_ago = now.saturating_sub(86400);

        let mut count_24h = 0u64;
        let mut volume_24h = 0.0f64;
        let divisor = 10f64.powi(decimals as i32);

        for tx in transfers {
            let timestamp = tx
                .get("timeStamp")
                .and_then(|t| t.as_str())
                .and_then(|t| t.parse::<u64>().ok())
                .unwrap_or(0);

            if timestamp >= one_day_ago {
                count_24h += 1;
                let value = tx
                    .get("value")
                    .and_then(|v| v.as_str())
                    .and_then(|v| v.parse::<f64>().ok())
                    .unwrap_or(0.0);
                volume_24h += value / divisor;
            }
        }

        // If we have < 24h of data in the 100 transfers, extrapolate
        if count_24h == 0 && !transfers.is_empty() {
            // Use the full sample to estimate daily rate
            let oldest = transfers
                .last()
                .and_then(|t| t.get("timeStamp"))
                .and_then(|t| t.as_str())
                .and_then(|t| t.parse::<u64>().ok())
                .unwrap_or(now);
            let span_secs = now.saturating_sub(oldest).max(1);
            let rate = transfers.len() as f64 / span_secs as f64;
            count_24h = (rate * 86400.0) as u64;

            let total_volume: f64 = transfers
                .iter()
                .filter_map(|tx| {
                    tx.get("value")
                        .and_then(|v| v.as_str())
                        .and_then(|v| v.parse::<f64>().ok())
                })
                .sum::<f64>()
                / divisor;
            volume_24h = total_volume * (86400.0 / span_secs as f64);
        }

        (count_24h, volume_24h)
    }

    fn calculate_recommendation(
        daily_transfers: u64,
        daily_volume: f64,
        _decimals: u8,
        total_supply_raw: &str,
    ) -> Result<RateLimitRecommendation> {
        // Parse total supply as whole tokens
        let supply_tokens = total_supply_raw
            .parse::<f64>()
            .unwrap_or(1_000_000_000.0);

        // Conservative rate limit: 10% of daily volume, floored at 0.1% of supply
        let volume_based_limit = (daily_volume * 0.1).max(1.0);
        let supply_floor = supply_tokens * 0.001; // 0.1% of supply as absolute minimum
        let recommended_daily = volume_based_limit.max(supply_floor) as u64;

        // Per-tx limit: 1% of daily limit (prevent single large drains)
        let per_tx = (recommended_daily as f64 * 0.01).max(1.0) as u64;

        let high_volume = daily_transfers > 1000;

        let reasoning = if daily_volume > 0.0 {
            format!(
                "Token moves ~{:.0} tokens/day across ~{} transfers. \
                 Recommended limit: {:.0} tokens/day (10% of volume). \
                 {}",
                daily_volume,
                daily_transfers,
                recommended_daily,
                if high_volume {
                    "High activity — consider tighter per-tx limits."
                } else {
                    "Moderate activity — standard limits appropriate."
                }
            )
        } else {
            format!(
                "No recent transfer activity detected. \
                 Using supply-based fallback: {:.0} tokens/day (0.1% of supply).",
                recommended_daily
            )
        };

        Ok(RateLimitRecommendation {
            daily_transfers,
            recommended_daily_limit: recommended_daily,
            recommended_per_tx_limit: per_tx,
            reasoning,
            high_volume_warning: high_volume,
        })
    }

    /// Fallback when no API key available — estimate from total supply
    fn fallback_recommendation(_decimals: u8, total_supply_raw: &str) -> RateLimitRecommendation {
        let supply_tokens = total_supply_raw
            .parse::<f64>()
            .unwrap_or(1_000_000_000.0);

        // Without volume data, use 0.1% of supply as conservative default
        let daily_limit = (supply_tokens * 0.001).max(1.0) as u64;
        let per_tx = (daily_limit as f64 * 0.01).max(1.0) as u64;

        RateLimitRecommendation {
            daily_transfers: 0,
            recommended_daily_limit: daily_limit,
            recommended_per_tx_limit: per_tx,
            reasoning: format!(
                "No Etherscan API key — using supply-based estimate: \
                 {:.0} tokens/day (0.1% of supply). \
                 Provide --etherscan-key for volume-based calculation.",
                daily_limit
            ),
            high_volume_warning: false,
        }
    }

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
