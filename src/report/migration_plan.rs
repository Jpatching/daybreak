use crate::types::{
    FullAnalysis, MigrationMethod, MigrationPlan, MigrationStep, NttDeploymentConfig, NttMode,
};

/// Generates migration plans based on analysis results
pub struct MigrationPlanGenerator;

impl MigrationPlanGenerator {
    /// Generate a complete migration plan
    pub fn generate(analysis: &FullAnalysis) -> MigrationPlan {
        let recommended_path = Self::determine_recommended_path(analysis);
        let paths = super::PathComparator::compare(analysis);
        let steps = Self::generate_steps(analysis, recommended_path);
        let ntt_config = Self::generate_ntt_config(analysis);

        MigrationPlan {
            recommended_path,
            paths,
            steps,
            ntt_config: Some(ntt_config),
        }
    }

    /// Determine the best migration path
    fn determine_recommended_path(analysis: &FullAnalysis) -> MigrationMethod {
        // If there are compatibility errors, NTT might not work
        if !analysis.compatibility.is_compatible {
            // Check if it's a fee-on-transfer issue
            if analysis.bytecode.has_fee_pattern {
                return MigrationMethod::NeonEvm;
            }
        }

        // If already on Solana, coordination needed
        if analysis.bridge_status.already_on_solana {
            // Still recommend NTT but with coordination
            return MigrationMethod::NttSunrise;
        }

        // Default recommendation is NTT
        MigrationMethod::NttSunrise
    }

    /// Generate step-by-step migration instructions
    fn generate_steps(analysis: &FullAnalysis, method: MigrationMethod) -> Vec<MigrationStep> {
        match method {
            MigrationMethod::NttSunrise => Self::generate_ntt_steps(analysis),
            MigrationMethod::NeonEvm => Self::generate_neon_steps(analysis),
            MigrationMethod::NativeRewrite => Self::generate_native_steps(analysis),
        }
    }

    fn generate_ntt_steps(analysis: &FullAnalysis) -> Vec<MigrationStep> {
        let mut steps = Vec::new();
        let mode = &analysis.compatibility.recommended_mode;

        steps.push(MigrationStep {
            order: 1,
            title: "Install NTT CLI".to_string(),
            description: "Install the Wormhole NTT CLI tool".to_string(),
            command: Some("npm install -g @wormhole-foundation/ntt-cli".to_string()),
        });

        steps.push(MigrationStep {
            order: 2,
            title: "Initialize NTT Project".to_string(),
            description: "Create a new NTT deployment configuration".to_string(),
            command: Some("ntt init".to_string()),
        });

        steps.push(MigrationStep {
            order: 3,
            title: "Configure Source Chain".to_string(),
            description: format!(
                "Add {} as source chain with {} mode",
                analysis.token.chain, mode
            ),
            command: Some(format!(
                "ntt add-chain {} --mode {} --token {}",
                analysis.token.chain.to_string().to_lowercase(),
                mode.to_string().to_lowercase(),
                analysis.token.address
            )),
        });

        steps.push(MigrationStep {
            order: 4,
            title: "Configure Destination Chain".to_string(),
            description: format!(
                "Add Solana as destination with {} decimals",
                analysis.compatibility.solana_decimals
            ),
            command: Some(format!(
                "ntt add-chain solana --mode burning --decimals {}",
                analysis.compatibility.solana_decimals
            )),
        });

        steps.push(MigrationStep {
            order: 5,
            title: "Deploy NTT Contracts".to_string(),
            description: "Deploy the NTT manager and transceiver contracts".to_string(),
            command: Some("ntt deploy".to_string()),
        });

        let rate_limit_desc = match &analysis.rate_limit {
            Some(rl) => format!(
                "Set rate limits based on transfer volume: {} tokens/day recommended",
                rl.recommended_daily_limit
            ),
            None => "Set up rate limits for bridge transfers (use --etherscan-key for volume-based recommendation)".to_string(),
        };
        let rate_limit_cmd = match &analysis.rate_limit {
            Some(rl) => format!("ntt configure-limits --daily-limit {}", rl.recommended_daily_limit),
            None => "ntt configure-limits --daily-limit 1000000".to_string(),
        };
        steps.push(MigrationStep {
            order: 6,
            title: "Configure Rate Limits".to_string(),
            description: rate_limit_desc,
            command: Some(rate_limit_cmd),
        });

        steps.push(MigrationStep {
            order: 7,
            title: "Test Transfer".to_string(),
            description: "Perform a test transfer with a small amount".to_string(),
            command: Some("ntt transfer --amount 1 --to <SOLANA_ADDRESS>".to_string()),
        });

        steps
    }

    fn generate_neon_steps(analysis: &FullAnalysis) -> Vec<MigrationStep> {
        vec![
            MigrationStep {
                order: 1,
                title: "Set Up Neon EVM".to_string(),
                description: "Configure Neon EVM RPC endpoint".to_string(),
                command: None,
            },
            MigrationStep {
                order: 2,
                title: "Deploy Token Contract".to_string(),
                description: format!("Deploy {} contract to Neon EVM", analysis.token.symbol),
                command: None,
            },
            MigrationStep {
                order: 3,
                title: "Configure Bridge".to_string(),
                description: "Set up Neon-native bridge for transfers".to_string(),
                command: None,
            },
        ]
    }

    fn generate_native_steps(_analysis: &FullAnalysis) -> Vec<MigrationStep> {
        vec![
            MigrationStep {
                order: 1,
                title: "Design Token Program".to_string(),
                description: "Design native Solana token program architecture".to_string(),
                command: None,
            },
            MigrationStep {
                order: 2,
                title: "Implement Token Program".to_string(),
                description: "Write Solana program in Rust using Anchor or native".to_string(),
                command: None,
            },
            MigrationStep {
                order: 3,
                title: "Deploy and Test".to_string(),
                description: "Deploy to devnet and run comprehensive tests".to_string(),
                command: None,
            },
            MigrationStep {
                order: 4,
                title: "Audit".to_string(),
                description: "Security audit recommended for production deployment".to_string(),
                command: None,
            },
        ]
    }

    fn generate_ntt_config(analysis: &FullAnalysis) -> NttDeploymentConfig {
        let source_mode = match analysis.compatibility.recommended_mode {
            NttMode::Locking => "locking",
            NttMode::Burning => "burning",
        };

        // NTT mode pairing: if source is locking, destination must be burning
        let dest_mode = match analysis.compatibility.recommended_mode {
            NttMode::Locking => "burning",
            NttMode::Burning => "burning", // Both sides burn for full burning mode
        };

        NttDeploymentConfig {
            network: crate::types::NetworkConfig {
                source_chain: analysis.token.chain.to_string().to_lowercase(),
                destination_chain: "solana".to_string(),
            },
            tokens: crate::types::TokensConfig {
                source: crate::types::SourceTokenConfig {
                    address: analysis.token.address.clone(),
                    mode: source_mode.to_string(),
                },
                destination: crate::types::DestinationTokenConfig {
                    decimals: analysis.compatibility.solana_decimals,
                    mode: dest_mode.to_string(),
                },
            },
        }
    }
}
