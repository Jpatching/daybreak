use anyhow::Result;
use reqwest::Client;

/// Checks Solana-related information
pub struct SolanaChecker {
    client: Client,
}

impl SolanaChecker {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    /// Estimate rent cost for SPL token account
    pub fn estimate_rent_cost(&self) -> f64 {
        // SPL Token account size is 165 bytes
        // Rent exemption is ~0.00203928 SOL (as of 2024)
        0.00203928
    }

    /// Estimate NTT deployment costs on Solana
    pub fn estimate_ntt_deployment_cost(&self) -> f64 {
        // NTT Manager program account rent
        // NTT Transceiver account rent
        // Token mint account rent
        // Estimated total: ~2-3 SOL
        2.5
    }

    /// Get current SOL price (placeholder - would use real API)
    pub async fn get_sol_price(&self) -> Result<f64> {
        // In production, fetch from CoinGecko/Jupiter
        // For demo, use a reasonable estimate
        Ok(150.0)
    }
}

impl Default for SolanaChecker {
    fn default() -> Self {
        Self::new()
    }
}
