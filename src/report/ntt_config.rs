use anyhow::Result;
use serde::Serialize;
use std::path::Path;
use crate::types::FullAnalysis;

/// Generates NTT deployment configuration files
pub struct NttConfigGenerator;

#[derive(Serialize)]
struct DeploymentJson {
    version: &'static str,
    network: NetworkSection,
    chains: ChainsSection,
}

#[derive(Serialize)]
struct NetworkSection {
    #[serde(rename = "type")]
    network_type: &'static str,
}

#[derive(Serialize)]
struct ChainsSection {
    source: ChainConfig,
    destination: ChainConfig,
}

#[derive(Serialize)]
struct ChainConfig {
    chain: String,
    token: TokenConfig,
    #[serde(skip_serializing_if = "Option::is_none")]
    ntt_manager: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    transceiver: Option<String>,
}

#[derive(Serialize)]
struct TokenConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    address: Option<String>,
    decimals: u8,
    mode: String,
}

impl NttConfigGenerator {
    /// Generate deployment.json content
    pub fn generate_deployment_json(analysis: &FullAnalysis) -> Result<String> {
        let config = &analysis.compatibility;

        let source_mode = config.recommended_mode.to_string().to_lowercase();

        // Destination is always burning when source is locking
        let dest_mode = if source_mode == "locking" {
            "burning"
        } else {
            "burning"
        };

        let deployment = DeploymentJson {
            version: "1.0.0",
            network: NetworkSection {
                network_type: "mainnet",
            },
            chains: ChainsSection {
                source: ChainConfig {
                    chain: analysis.token.chain.to_string().to_lowercase(),
                    token: TokenConfig {
                        address: Some(analysis.token.address.clone()),
                        decimals: analysis.token.decimals,
                        mode: source_mode,
                    },
                    ntt_manager: None,
                    transceiver: None,
                },
                destination: ChainConfig {
                    chain: "solana".to_string(),
                    token: TokenConfig {
                        address: None, // To be deployed
                        decimals: config.solana_decimals,
                        mode: dest_mode.to_string(),
                    },
                    ntt_manager: None,
                    transceiver: None,
                },
            },
        };

        serde_json::to_string_pretty(&deployment).map_err(Into::into)
    }

    /// Generate NTT CLI commands for deployment
    pub fn generate_cli_commands(analysis: &FullAnalysis) -> Vec<String> {
        let mode = analysis.compatibility.recommended_mode.to_string().to_lowercase();
        let chain = analysis.token.chain.to_string().to_lowercase();

        vec![
            "# NTT Deployment Commands".to_string(),
            "".to_string(),
            "# 1. Initialize project".to_string(),
            "ntt init".to_string(),
            "".to_string(),
            format!("# 2. Add source chain ({})", chain),
            format!(
                "ntt add-chain {} --mode {} --token {}",
                chain, mode, analysis.token.address
            ),
            "".to_string(),
            "# 3. Add destination chain (Solana)".to_string(),
            format!(
                "ntt add-chain solana --mode burning --decimals {}",
                analysis.compatibility.solana_decimals
            ),
            "".to_string(),
            "# 4. Deploy contracts".to_string(),
            "ntt deploy".to_string(),
            "".to_string(),
            "# 5. Configure rate limits (adjust as needed)".to_string(),
            "ntt configure-limits --daily-limit 1000000".to_string(),
        ]
    }

    /// Write deployment.json to file
    pub async fn write_deployment_json(analysis: &FullAnalysis, output_dir: &Path) -> Result<()> {
        let content = Self::generate_deployment_json(analysis)?;
        let path = output_dir.join("deployment.json");
        tokio::fs::write(&path, content).await?;
        Ok(())
    }
}
