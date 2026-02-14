use anyhow::{Context, Result};
use crate::types::{Chain, TokenInfo};
use super::decoder::AbiDecoder;
use super::rpc::EvmRpcClient;

/// Function selectors for ERC-20 methods
pub mod selectors {
    pub const NAME: &str = "0x06fdde03";
    pub const SYMBOL: &str = "0x95d89b41";
    pub const DECIMALS: &str = "0x313ce567";
    pub const TOTAL_SUPPLY: &str = "0x18160ddd";
}

/// Analyzes ERC-20 token metadata
pub struct TokenAnalyzer<'a> {
    rpc: &'a EvmRpcClient,
}

impl<'a> TokenAnalyzer<'a> {
    pub fn new(rpc: &'a EvmRpcClient) -> Self {
        Self { rpc }
    }

    /// Fetch complete token information
    pub async fn get_token_info(&self, address: &str, chain: Chain) -> Result<TokenInfo> {
        // Normalize address to checksummed format
        let address = Self::normalize_address(address)?;

        // Fetch all metadata in parallel
        let (name, symbol, decimals, total_supply) = tokio::try_join!(
            self.get_name(&address),
            self.get_symbol(&address),
            self.get_decimals(&address),
            self.get_total_supply(&address),
        )?;

        Ok(TokenInfo {
            address,
            chain,
            name,
            symbol,
            decimals,
            total_supply,
        })
    }

    /// Normalize and validate Ethereum address
    fn normalize_address(address: &str) -> Result<String> {
        let address = address.trim();

        if !address.starts_with("0x") && !address.starts_with("0X") {
            anyhow::bail!("Address must start with 0x");
        }

        if address.len() != 42 {
            anyhow::bail!("Address must be 42 characters (including 0x prefix)");
        }

        // Validate hex characters
        let hex_part = &address[2..];
        if !hex_part.chars().all(|c| c.is_ascii_hexdigit()) {
            anyhow::bail!("Address contains invalid characters");
        }

        // Return lowercase normalized form
        Ok(address.to_lowercase())
    }

    async fn get_name(&self, address: &str) -> Result<String> {
        let result = self
            .rpc
            .eth_call(address, selectors::NAME)
            .await
            .context("Failed to fetch token name")?;

        AbiDecoder::decode_string(&result).context("Failed to decode token name")
    }

    async fn get_symbol(&self, address: &str) -> Result<String> {
        let result = self
            .rpc
            .eth_call(address, selectors::SYMBOL)
            .await
            .context("Failed to fetch token symbol")?;

        AbiDecoder::decode_string(&result).context("Failed to decode token symbol")
    }

    async fn get_decimals(&self, address: &str) -> Result<u8> {
        let result = self
            .rpc
            .eth_call(address, selectors::DECIMALS)
            .await
            .context("Failed to fetch token decimals")?;

        AbiDecoder::decode_uint8(&result).context("Failed to decode token decimals")
    }

    async fn get_total_supply(&self, address: &str) -> Result<String> {
        let result = self
            .rpc
            .eth_call(address, selectors::TOTAL_SUPPLY)
            .await
            .context("Failed to fetch total supply")?;

        AbiDecoder::decode_uint256(&result).context("Failed to decode total supply")
    }
}
