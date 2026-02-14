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

        // Mint capability is good for burning mode
        if capabilities.has_mint {
            issues.push(CompatibilityIssue {
                severity: IssueSeverity::Info,
                code: "MINTABLE".to_string(),
                title: "Mintable Token".to_string(),
                description: "Token has mint capability, enabling burning mode on source chain."
                    .to_string(),
                recommendation: "Burning mode recommended: burn on source, mint on destination."
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

    /// Determine recommended NTT mode based on token capabilities
    fn determine_mode(capabilities: &TokenCapabilities) -> NttMode {
        // If token can burn, burning mode is preferred
        // (burn on source, mint on destination)
        if capabilities.has_burn || capabilities.has_mint {
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
        assert!(result
            .issues
            .iter()
            .any(|i| i.code == "DECIMAL_TRIM"));
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

        let result =
            CompatibilityChecker::check(&token, &TokenCapabilities::default(), &bytecode);

        assert!(!result.is_compatible);
        assert!(result
            .issues
            .iter()
            .any(|i| i.code == "FEE_ON_TRANSFER" && i.severity == IssueSeverity::Error));
    }
}
