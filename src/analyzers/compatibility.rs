use crate::types::{
    BytecodeAnalysis, CompatibilityIssue, CompatibilityResult, IssueSeverity, NttMode,
    TokenCapabilities, TokenInfo,
};

/// Checks NTT compatibility for a token
pub struct CompatibilityChecker;

impl CompatibilityChecker {
    /// Perform full compatibility analysis
    pub fn check(
        token: &TokenInfo,
        capabilities: &TokenCapabilities,
        bytecode: &BytecodeAnalysis,
    ) -> CompatibilityResult {
        let mut issues = Vec::new();

        // Check decimals
        let (decimal_trimming_required, solana_decimals) =
            Self::check_decimals(token.decimals, &mut issues);

        // Check rebasing — catastrophic for NTT bridging
        Self::check_rebasing(capabilities, &mut issues);

        // Check token features
        Self::check_features(capabilities, bytecode, &mut issues);

        // Check bytecode concerns
        Self::check_bytecode(bytecode, &mut issues);

        // Determine recommended mode
        let recommended_mode = Self::determine_mode(capabilities);

        // Overall compatibility
        let is_compatible = !issues.iter().any(|i| i.severity == IssueSeverity::Error);

        CompatibilityResult {
            is_compatible,
            recommended_mode,
            issues,
            decimal_trimming_required,
            solana_decimals,
        }
    }

    /// Check decimal compatibility with Solana
    fn check_decimals(decimals: u8, issues: &mut Vec<CompatibilityIssue>) -> (bool, u8) {
        // SPL tokens support max 9 decimals, NTT caps at 8
        let max_solana_decimals = 8;

        if decimals > max_solana_decimals {
            issues.push(CompatibilityIssue {
                severity: IssueSeverity::Warning,
                code: "DECIMAL_TRIM".to_string(),
                title: "Decimal Trimming Required".to_string(),
                description: format!(
                    "Token has {} decimals but NTT supports max {}. \
                     Amounts will be trimmed, potentially causing precision loss.",
                    decimals, max_solana_decimals
                ),
                recommendation: format!(
                    "Solana token will use {} decimals. Ensure your application \
                     handles the decimal difference correctly.",
                    max_solana_decimals
                ),
            });
            (true, max_solana_decimals)
        } else {
            (false, decimals)
        }
    }

    /// Rebasing tokens change balances without transfers — locked tokens desync from minted tokens
    fn check_rebasing(capabilities: &TokenCapabilities, issues: &mut Vec<CompatibilityIssue>) {
        if capabilities.is_rebasing {
            issues.push(CompatibilityIssue {
                severity: IssueSeverity::Error,
                code: "REBASING".to_string(),
                title: "Rebasing Token Detected".to_string(),
                description: "This token rebases (adjusts balances without transfers). \
                    When bridged via NTT in locking mode, locked tokens on the source chain \
                    will desync from minted tokens on Solana, causing loss of funds."
                    .to_string(),
                recommendation: "Rebasing tokens are incompatible with NTT. Consider \
                    wrapping the token in a non-rebasing wrapper (e.g. wstETH for stETH) \
                    before bridging."
                    .to_string(),
            });
        }
    }

    /// Check token feature compatibility
    fn check_features(
        capabilities: &TokenCapabilities,
        bytecode: &BytecodeAnalysis,
        issues: &mut Vec<CompatibilityIssue>,
    ) {
        // Fee-on-transfer is problematic
        if bytecode.has_fee_pattern {
            issues.push(CompatibilityIssue {
                severity: IssueSeverity::Error,
                code: "FEE_ON_TRANSFER".to_string(),
                title: "Fee-on-Transfer Detected".to_string(),
                description: "Token appears to charge fees on transfers. \
                    This is incompatible with NTT bridging as the fee mechanism \
                    cannot be replicated across chains."
                    .to_string(),
                recommendation: "Consider deploying a wrapper token without fees, \
                    or use a different bridging solution."
                    .to_string(),
            });
        }

        // Pausable tokens need consideration
        if capabilities.has_pause {
            issues.push(CompatibilityIssue {
                severity: IssueSeverity::Warning,
                code: "PAUSABLE".to_string(),
                title: "Pausable Token".to_string(),
                description: "Token can be paused by owner. If paused during \
                    a bridge transfer, funds could be locked."
                    .to_string(),
                recommendation: "Ensure pause functionality won't interfere with \
                    bridge operations. Consider governance controls."
                    .to_string(),
            });
        }

        // Blacklist can prevent transfers
        if capabilities.has_blacklist {
            issues.push(CompatibilityIssue {
                severity: IssueSeverity::Warning,
                code: "BLACKLIST".to_string(),
                title: "Blacklist Functionality".to_string(),
                description: "Token has blacklist capability. Blacklisted addresses \
                    cannot transfer tokens, which could affect bridge operations."
                    .to_string(),
                recommendation: "Ensure NTT contracts are not blacklistable. \
                    Document blacklist policy for users."
                    .to_string(),
            });
        }

        // Mint capability noted but not sufficient alone for burning mode
        if capabilities.has_mint {
            issues.push(CompatibilityIssue {
                severity: IssueSeverity::Info,
                code: "MINTABLE".to_string(),
                title: "Mintable Token".to_string(),
                description: "Token has mint capability on the source chain.".to_string(),
                recommendation: "Mint capability alone does not enable burning mode. \
                    Burning mode requires burn capability so the NTT manager can burn tokens."
                    .to_string(),
            });
        }

        // Burn capability
        if capabilities.has_burn {
            issues.push(CompatibilityIssue {
                severity: IssueSeverity::Info,
                code: "BURNABLE".to_string(),
                title: "Burnable Token".to_string(),
                description: "Token supports burning, compatible with NTT burning mode."
                    .to_string(),
                recommendation: "Burning mode is the preferred NTT configuration.".to_string(),
            });
        }
    }

    /// Check bytecode-related concerns
    fn check_bytecode(bytecode: &BytecodeAnalysis, issues: &mut Vec<CompatibilityIssue>) {
        if bytecode.has_selfdestruct {
            issues.push(CompatibilityIssue {
                severity: IssueSeverity::Warning,
                code: "SELFDESTRUCT".to_string(),
                title: "Self-destruct Capability".to_string(),
                description: "Contract contains selfdestruct opcode. If triggered, \
                    bridged tokens could become worthless."
                    .to_string(),
                recommendation: "Review contract for selfdestruct conditions. \
                    Ensure it cannot be called maliciously."
                    .to_string(),
            });
        }

        if bytecode.is_proxy {
            issues.push(CompatibilityIssue {
                severity: IssueSeverity::Info,
                code: "PROXY".to_string(),
                title: "Upgradeable Proxy".to_string(),
                description: format!(
                    "Contract is an upgradeable proxy ({:?}). \
                     Implementation can change over time.",
                    bytecode.proxy_type
                ),
                recommendation: "Monitor for upgrades. NTT integration should be \
                    re-verified after any implementation changes."
                    .to_string(),
            });
        }
    }

    /// Determine recommended NTT mode based on token capabilities.
    /// Burning mode requires burn capability on the source chain so the
    /// NTT manager can burn tokens when bridging. Mint-only is not enough.
    fn determine_mode(capabilities: &TokenCapabilities) -> NttMode {
        if capabilities.has_burn {
            NttMode::Burning
        } else {
            // Locking mode: lock on source, mint on destination
            NttMode::Locking
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::Chain;

    #[test]
    fn test_high_decimals_warning() {
        let token = TokenInfo {
            address: "0x0".to_string(),
            chain: Chain::Ethereum,
            name: "Test".to_string(),
            symbol: "TEST".to_string(),
            decimals: 18,
            total_supply: "1000000".to_string(),
        };

        let result = CompatibilityChecker::check(
            &token,
            &TokenCapabilities::default(),
            &BytecodeAnalysis::default(),
        );

        assert!(result.decimal_trimming_required);
        assert_eq!(result.solana_decimals, 8);
        assert!(result.issues.iter().any(|i| i.code == "DECIMAL_TRIM"));
    }

    #[test]
    fn test_fee_on_transfer_error() {
        let token = TokenInfo {
            address: "0x0".to_string(),
            chain: Chain::Ethereum,
            name: "Test".to_string(),
            symbol: "TEST".to_string(),
            decimals: 6,
            total_supply: "1000000".to_string(),
        };

        let bytecode = BytecodeAnalysis {
            has_fee_pattern: true,
            ..Default::default()
        };

        let result = CompatibilityChecker::check(&token, &TokenCapabilities::default(), &bytecode);

        assert!(!result.is_compatible);
        assert!(result
            .issues
            .iter()
            .any(|i| i.code == "FEE_ON_TRANSFER" && i.severity == IssueSeverity::Error));
    }

    // ── Mode determination ─────────────────────────────────

    #[test]
    fn test_determine_mode_burning() {
        let caps = TokenCapabilities {
            has_burn: true,
            ..Default::default()
        };
        assert_eq!(
            CompatibilityChecker::determine_mode(&caps),
            NttMode::Burning
        );
    }

    #[test]
    fn test_determine_mode_locking() {
        assert_eq!(
            CompatibilityChecker::determine_mode(&TokenCapabilities::default()),
            NttMode::Locking
        );
    }

    // ── Decimal handling ───────────────────────────────────

    #[test]
    fn test_no_trimming_for_6_decimals() {
        let token = TokenInfo {
            address: "0x0".to_string(),
            chain: Chain::Ethereum,
            name: "Test".to_string(),
            symbol: "TEST".to_string(),
            decimals: 6,
            total_supply: "1000000".to_string(),
        };
        let result = CompatibilityChecker::check(
            &token,
            &TokenCapabilities::default(),
            &BytecodeAnalysis::default(),
        );
        assert!(!result.decimal_trimming_required);
        assert_eq!(result.solana_decimals, 6);
    }

    #[test]
    fn test_trimming_for_9_decimals() {
        let token = TokenInfo {
            address: "0x0".to_string(),
            chain: Chain::Ethereum,
            name: "Test".to_string(),
            symbol: "TEST".to_string(),
            decimals: 9,
            total_supply: "1000000".to_string(),
        };
        let result = CompatibilityChecker::check(
            &token,
            &TokenCapabilities::default(),
            &BytecodeAnalysis::default(),
        );
        assert!(result.decimal_trimming_required);
        assert_eq!(result.solana_decimals, 8);
    }

    // ── Rebasing → incompatible ────────────────────────────

    #[test]
    fn test_rebasing_incompatible() {
        let token = TokenInfo {
            address: "0x0".to_string(),
            chain: Chain::Ethereum,
            name: "stETH".to_string(),
            symbol: "stETH".to_string(),
            decimals: 18,
            total_supply: "1000000".to_string(),
        };
        let caps = TokenCapabilities {
            is_rebasing: true,
            ..Default::default()
        };
        let result = CompatibilityChecker::check(&token, &caps, &BytecodeAnalysis::default());
        assert!(!result.is_compatible);
        assert!(result
            .issues
            .iter()
            .any(|i| i.code == "REBASING" && i.severity == IssueSeverity::Error));
    }

    // ── Combined features: pausable + blacklistable ────────

    #[test]
    fn test_pausable_blacklistable_compatible_with_warnings() {
        let token = TokenInfo {
            address: "0x0".to_string(),
            chain: Chain::Ethereum,
            name: "Test".to_string(),
            symbol: "TEST".to_string(),
            decimals: 6,
            total_supply: "1000000".to_string(),
        };
        let caps = TokenCapabilities {
            has_pause: true,
            has_blacklist: true,
            ..Default::default()
        };
        let result = CompatibilityChecker::check(&token, &caps, &BytecodeAnalysis::default());
        assert!(result.is_compatible); // warnings don't block
        assert!(result.issues.iter().any(|i| i.code == "PAUSABLE"));
        assert!(result.issues.iter().any(|i| i.code == "BLACKLIST"));
    }

    // ── Burnable token produces Info issue ──────────────────

    #[test]
    fn test_burnable_info_issue() {
        let token = TokenInfo {
            address: "0x0".to_string(),
            chain: Chain::Ethereum,
            name: "Test".to_string(),
            symbol: "TEST".to_string(),
            decimals: 6,
            total_supply: "1000000".to_string(),
        };
        let caps = TokenCapabilities {
            has_burn: true,
            ..Default::default()
        };
        let result = CompatibilityChecker::check(&token, &caps, &BytecodeAnalysis::default());
        assert!(result.is_compatible);
        assert!(result
            .issues
            .iter()
            .any(|i| i.code == "BURNABLE" && i.severity == IssueSeverity::Info));
    }
}
