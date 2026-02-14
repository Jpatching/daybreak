pub mod rpc;
pub mod token;
pub mod bytecode;
pub mod decoder;

use anyhow::Result;
use crate::types::{Chain, TokenInfo, TokenCapabilities, BytecodeAnalysis};

pub use rpc::EvmRpcClient;
pub use token::TokenAnalyzer;
pub use bytecode::BytecodeAnalyzer;

/// Main EVM analyzer combining all EVM-related analysis
pub struct EvmAnalyzer {
    rpc: EvmRpcClient,
    chain: Chain,
}

impl EvmAnalyzer {
    pub fn new(chain: Chain, rpc_url: Option<String>) -> Self {
        let url = rpc_url.unwrap_or_else(|| chain.default_rpc_url().to_string());
        Self {
            rpc: EvmRpcClient::new(&url),
            chain,
        }
    }

    /// Fetch basic token information (name, symbol, decimals, supply)
    pub async fn get_token_info(&self, address: &str) -> Result<TokenInfo> {
        let token_analyzer = TokenAnalyzer::new(&self.rpc);
        token_analyzer.get_token_info(address, self.chain).await
    }

    /// Detect token capabilities from bytecode/function signatures
    pub async fn get_capabilities(&self, address: &str) -> Result<TokenCapabilities> {
        let bytecode = self.rpc.get_code(address).await?;
        let bytecode_analyzer = BytecodeAnalyzer::new();
        Ok(bytecode_analyzer.detect_capabilities(&bytecode))
    }

    /// Analyze contract bytecode for proxy patterns and dangerous opcodes
    pub async fn analyze_bytecode(&self, address: &str) -> Result<BytecodeAnalysis> {
        let bytecode = self.rpc.get_code(address).await?;
        let bytecode_analyzer = BytecodeAnalyzer::new();
        let mut analysis = bytecode_analyzer.analyze(&bytecode);

        // If it's a proxy, try to fetch the implementation address
        if analysis.is_proxy {
            if let Ok(Some(impl_addr)) = self.rpc.get_eip1967_implementation(address).await {
                analysis.implementation_address = Some(impl_addr);
            }
        }

        Ok(analysis)
    }
}
