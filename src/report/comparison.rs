use crate::types::{Feasibility, FullAnalysis, MigrationMethod, MigrationPath};

/// Compares different migration paths
pub struct PathComparator;

impl PathComparator {
    /// Compare all migration paths for a token
    pub fn compare(analysis: &FullAnalysis) -> Vec<MigrationPath> {
        vec![
            Self::evaluate_ntt(analysis),
            Self::evaluate_neon(analysis),
            Self::evaluate_native(analysis),
        ]
    }

    fn evaluate_ntt(analysis: &FullAnalysis) -> MigrationPath {
        let mut feasibility = Feasibility::Recommended;
        let mut cons = Vec::new();

        // Check for blocking issues
        if !analysis.compatibility.is_compatible {
            feasibility = Feasibility::NotRecommended;
            cons.push("Compatibility issues detected".to_string());
        }

        if analysis.bytecode.has_fee_pattern {
            feasibility = Feasibility::NotRecommended;
            cons.push("Fee-on-transfer not supported".to_string());
        }

        if analysis.compatibility.decimal_trimming_required {
            cons.push(format!(
                "Decimal trimming: {} → {}",
                analysis.token.decimals, analysis.compatibility.solana_decimals
            ));
        }

        if analysis.bridge_status.already_on_solana {
            cons.push("Token already exists on Solana, coordination needed".to_string());
            if feasibility == Feasibility::Recommended {
                feasibility = Feasibility::Viable;
            }
        }

        MigrationPath {
            method: MigrationMethod::NttSunrise,
            feasibility,
            estimated_cost_usd: "$50-150".to_string(),
            estimated_time: "1-2 weeks".to_string(),
            pros: vec![
                "Native token on Solana".to_string(),
                "Full DeFi compatibility".to_string(),
                "Best user experience".to_string(),
                "Wormhole security".to_string(),
            ],
            cons,
        }
    }

    fn evaluate_neon(analysis: &FullAnalysis) -> MigrationPath {
        let mut feasibility = Feasibility::Viable;
        let mut pros = vec![
            "EVM compatibility maintained".to_string(),
            "Minimal code changes".to_string(),
            "Fast deployment".to_string(),
        ];
        let mut cons = vec![
            "Not a native SPL token".to_string(),
            "Limited DeFi integrations".to_string(),
            "Higher per-transaction costs".to_string(),
        ];

        // Fee-on-transfer tokens might work better on Neon
        if analysis.bytecode.has_fee_pattern {
            feasibility = Feasibility::Recommended;
            pros.push("Fee mechanics preserved".to_string());
        }

        // Complex contracts suit Neon better
        if analysis.bytecode.size_bytes > 15000 {
            cons.push("Large contract may have high deployment cost".to_string());
        }

        MigrationPath {
            method: MigrationMethod::NeonEvm,
            feasibility,
            estimated_cost_usd: "$100-500".to_string(),
            estimated_time: "1-3 days".to_string(),
            pros,
            cons,
        }
    }

    fn evaluate_native(_analysis: &FullAnalysis) -> MigrationPath {
        MigrationPath {
            method: MigrationMethod::NativeRewrite,
            feasibility: Feasibility::Viable,
            estimated_cost_usd: "$5,000-50,000+".to_string(),
            estimated_time: "4-12 weeks".to_string(),
            pros: vec![
                "Full Solana optimization".to_string(),
                "Best performance".to_string(),
                "Complete customization".to_string(),
                "Native SPL token".to_string(),
            ],
            cons: vec![
                "Significant development effort".to_string(),
                "Requires Solana expertise".to_string(),
                "Security audit recommended".to_string(),
                "Migration complexity for existing holders".to_string(),
            ],
        }
    }
}
