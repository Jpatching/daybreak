use crate::types::FullAnalysis;
use anyhow::Result;
use serde::Serialize;

/// Generates NTT deployment configuration files
pub struct NttConfigGenerator;

#[derive(Serialize)]
struct DeploymentJson {
    version: &'static str,
    network: NetworkSection,
    chains: ChainsSection,
    #[serde(skip_serializing_if = "Option::is_none")]
    rate_limits: Option<RateLimitsSection>,
}

#[derive(Serialize)]
struct RateLimitsSection {
    daily_limit: u64,
    per_transaction_limit: u64,
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

        // NTT destination is always burning
        let dest_mode = "burning";

        let rate_limits = analysis.rate_limit.as_ref().map(|rl| RateLimitsSection {
            daily_limit: rl.recommended_daily_limit,
            per_transaction_limit: rl.recommended_per_tx_limit,
        });

        let deployment = DeploymentJson {
            version: "1.0.0",
            network: NetworkSection {
                network_type: "mainnet",
            },
            rate_limits,
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
        let mode = analysis
            .compatibility
            .recommended_mode
            .to_string()
            .to_lowercase();
        let chain = analysis.token.chain.to_string().to_lowercase();

        let daily_limit = analysis
            .rate_limit
            .as_ref()
            .map(|r| r.recommended_daily_limit)
            .unwrap_or(1_000_000);

        let mut cmds = vec![
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
        ];

        // Rate limit command with calculated or fallback value
        if let Some(ref rl) = analysis.rate_limit {
            cmds.push(format!(
                "# 5. Configure rate limits (based on {} daily transfers)",
                rl.daily_transfers
            ));
            cmds.push(format!(
                "ntt configure-limits --daily-limit {}",
                rl.recommended_daily_limit
            ));
        } else {
            cmds.push("# 5. Configure rate limits (adjust based on expected volume)".to_string());
            cmds.push(format!("ntt configure-limits --daily-limit {}", daily_limit));
        }

        // Post-deploy: transfer mint authority
        cmds.push("".to_string());
        cmds.push("# 6. Transfer SPL mint authority to NTT manager (REQUIRED for bridging)".to_string());
        cmds.push("# Replace <NTT_MANAGER> with the address from `ntt deploy` output".to_string());
        cmds.push("spl-token authorize <SPL_MINT> mint <NTT_MANAGER>".to_string());

        cmds.push("".to_string());
        cmds.push("# 7. Test transfer".to_string());
        cmds.push("ntt transfer --amount 1 --to <SOLANA_ADDRESS>".to_string());

        cmds
    }
}
