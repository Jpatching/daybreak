use crate::types::{
    BridgeStatus, BytecodeAnalysis, BytecodeComplexity, HolderData, RiskComponents, RiskScore,
    TokenCapabilities, TokenInfo,
};

/// Calculates composite risk score for token migration
pub struct RiskScorer;

impl RiskScorer {
    /// Calculate full risk score from all available data
    pub fn calculate(
        token: &TokenInfo,
        capabilities: &TokenCapabilities,
        bytecode: &BytecodeAnalysis,
        bridge_status: &BridgeStatus,
        holder_data: Option<&HolderData>,
    ) -> RiskScore {
        let components = RiskComponents {
            decimal_handling: Self::score_decimals(token.decimals),
            token_features: Self::score_features(capabilities, bytecode),
            bytecode_complexity: Self::score_bytecode(bytecode),
            holder_concentration: Self::score_holders(holder_data),
            bridge_status: Self::score_bridge(bridge_status),
        };

        RiskScore::from_components(components)
    }

    /// Score decimal handling complexity (0-20 points)
    /// Gradual scale based on how much trimming NTT needs
    fn score_decimals(decimals: u8) -> u8 {
        match decimals {
            0..=8 => 0,    // No trimming needed
            9 => 3,        // Minimal trimming
            10..=12 => 8,  // Moderate trimming
            13..=15 => 14, // Significant trimming
            _ => 20,       // Maximum trimming (16-18 decimals)
        }
    }

    /// Score token features risk (0-25 points)
    fn score_features(capabilities: &TokenCapabilities, bytecode: &BytecodeAnalysis) -> u8 {
        // Rebasing = catastrophic for NTT bridging, instant max
        if capabilities.is_rebasing {
            return 25;
        }

        let mut score = 0u8;

        // Fee-on-transfer is highly problematic for bridges
        if bytecode.has_fee_pattern {
            score += 15;
        }

        // Pausable tokens can cause bridge issues
        if capabilities.has_pause {
            score += 3;
        }

        // Blacklist can prevent transfers
        if capabilities.has_blacklist {
            score += 4;
        }

        // Selfdestruct is dangerous
        if bytecode.has_selfdestruct {
            score += 3;
        }

        score.min(25)
    }

    /// Score bytecode complexity (0-20 points)
    fn score_bytecode(bytecode: &BytecodeAnalysis) -> u8 {
        let mut score = match bytecode.complexity {
            BytecodeComplexity::Simple => 0,
            BytecodeComplexity::Moderate => 8,
            BytecodeComplexity::Complex => 15,
        };

        // Proxy adds complexity
        if bytecode.is_proxy {
            score += 5;
        }

        score.min(20)
    }

    /// Score holder concentration risk (0-15 points)
    fn score_holders(holder_data: Option<&HolderData>) -> u8 {
        match holder_data {
            None => 5, // Missing data = unknown risk, not zero
            Some(data) => {
                // Check if top-1 holder dominates
                if let Some(top) = data.top_holders.first() {
                    if top.percentage > 50.0 {
                        return 15; // Single entity controls majority
                    }
                }

                let concentration = data.top_10_concentration;
                if concentration < 50.0 {
                    0 // Well distributed
                } else if concentration < 70.0 {
                    5 // Moderately concentrated
                } else if concentration < 85.0 {
                    10 // Highly concentrated
                } else {
                    15 // Extremely concentrated
                }
            }
        }
    }

    /// Score bridge status (0-20 points)
    fn score_bridge(bridge_status: &BridgeStatus) -> u8 {
        if bridge_status.already_on_solana {
            // Already bridged = coordination needed
            15
        } else if bridge_status.wormhole_attested {
            // Wormhole attested but not on Solana
            5
        } else {
            0 // Fresh token, no complications
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Chain, HolderInfo};

    fn sample_token(decimals: u8) -> TokenInfo {
        TokenInfo {
            address: "0x0".to_string(),
            chain: Chain::Ethereum,
            name: "Test".to_string(),
            symbol: "TEST".to_string(),
            decimals,
            total_supply: "1000000".to_string(),
        }
    }

    #[test]
    fn test_decimals_scoring() {
        assert_eq!(RiskScorer::score_decimals(6), 0);
        assert_eq!(RiskScorer::score_decimals(8), 0);
        assert_eq!(RiskScorer::score_decimals(9), 3);
        assert_eq!(RiskScorer::score_decimals(12), 8);
        assert_eq!(RiskScorer::score_decimals(15), 14);
        assert_eq!(RiskScorer::score_decimals(18), 20);
    }

    #[test]
    fn test_low_risk_token() {
        let token = sample_token(6);
        let capabilities = TokenCapabilities::default();
        let bytecode = BytecodeAnalysis::default();
        let bridge_status = BridgeStatus::default();

        let score = RiskScorer::calculate(&token, &capabilities, &bytecode, &bridge_status, None);

        // Missing holder data now adds 5 points (unknown risk penalty)
        assert_eq!(score.components.holder_concentration, 5);
        assert!(score.total <= 33);
        assert_eq!(score.rating, crate::types::RiskRating::Low);
    }

    // ── Token features scoring ─────────────────────────────

    #[test]
    fn test_features_rebasing_instant_max() {
        let caps = TokenCapabilities {
            is_rebasing: true,
            ..Default::default()
        };
        assert_eq!(
            RiskScorer::score_features(&caps, &BytecodeAnalysis::default()),
            25
        );
    }

    #[test]
    fn test_features_fee_pause_blacklist_combo() {
        let caps = TokenCapabilities {
            has_pause: true,
            has_blacklist: true,
            ..Default::default()
        };
        let bytecode = BytecodeAnalysis {
            has_fee_pattern: true,
            ..Default::default()
        };
        // 15 + 3 + 4 = 22, capped at 25
        assert_eq!(RiskScorer::score_features(&caps, &bytecode), 22);
    }

    #[test]
    fn test_features_cap_at_25() {
        let caps = TokenCapabilities {
            has_pause: true,
            has_blacklist: true,
            ..Default::default()
        };
        let bytecode = BytecodeAnalysis {
            has_fee_pattern: true,
            has_selfdestruct: true,
            ..Default::default()
        };
        // 15 + 3 + 4 + 3 = 25 → capped at 25
        assert_eq!(RiskScorer::score_features(&caps, &bytecode), 25);
    }

    // ── Holder concentration scoring ───────────────────────

    #[test]
    fn test_holders_no_data() {
        assert_eq!(RiskScorer::score_holders(None), 5);
    }

    #[test]
    fn test_holders_top_holder_majority() {
        let data = HolderData {
            top_holders: vec![HolderInfo {
                address: "0x1".to_string(),
                balance: "500".to_string(),
                percentage: 51.0,
            }],
            top_10_concentration: 60.0,
            total_holders: Some(100),
        };
        assert_eq!(RiskScorer::score_holders(Some(&data)), 15);
    }

    #[test]
    fn test_holders_concentration_bands() {
        let make = |concentration: f64| HolderData {
            top_holders: vec![HolderInfo {
                address: "0x1".to_string(),
                balance: "100".to_string(),
                percentage: 10.0, // not majority
            }],
            top_10_concentration: concentration,
            total_holders: Some(1000),
        };
        assert_eq!(RiskScorer::score_holders(Some(&make(49.9))), 0);
        assert_eq!(RiskScorer::score_holders(Some(&make(69.9))), 5);
        assert_eq!(RiskScorer::score_holders(Some(&make(84.9))), 10);
        assert_eq!(RiskScorer::score_holders(Some(&make(85.0))), 15);
    }

    // ── Bridge status scoring ──────────────────────────────

    #[test]
    fn test_bridge_already_on_solana() {
        let bs = BridgeStatus {
            already_on_solana: true,
            ..Default::default()
        };
        assert_eq!(RiskScorer::score_bridge(&bs), 15);
    }

    #[test]
    fn test_bridge_wormhole_attested() {
        let bs = BridgeStatus {
            wormhole_attested: true,
            ..Default::default()
        };
        assert_eq!(RiskScorer::score_bridge(&bs), 5);
    }

    #[test]
    fn test_bridge_fresh_token() {
        assert_eq!(RiskScorer::score_bridge(&BridgeStatus::default()), 0);
    }

    // ── Full integration: high-risk token ──────────────────

    #[test]
    fn test_high_risk_token() {
        let token = sample_token(18); // 20 pts decimals
        let capabilities = TokenCapabilities {
            is_rebasing: true, // 25 pts features
            ..Default::default()
        };
        let bytecode = BytecodeAnalysis {
            is_proxy: true,
            complexity: BytecodeComplexity::Complex,
            ..Default::default()
        }; // 15 + 5 = 20 pts bytecode
        let bridge = BridgeStatus {
            already_on_solana: true,
            ..Default::default()
        }; // 15 pts bridge
        let holders = HolderData {
            top_holders: vec![HolderInfo {
                address: "0x1".to_string(),
                balance: "600".to_string(),
                percentage: 60.0,
            }],
            top_10_concentration: 90.0,
            total_holders: Some(50),
        }; // 15 pts holders

        let score =
            RiskScorer::calculate(&token, &capabilities, &bytecode, &bridge, Some(&holders));
        // 20 + 25 + 20 + 15 + 15 = 95 → capped at 100
        assert_eq!(score.rating, crate::types::RiskRating::High);
        assert!(score.total >= 67);
    }
}
