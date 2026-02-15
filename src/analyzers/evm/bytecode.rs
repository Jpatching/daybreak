use crate::types::{BytecodeAnalysis, BytecodeComplexity, ProxyType, TokenCapabilities};

/// Function selectors for token capability detection
mod capability_selectors {
    pub const MINT: &str = "40c10f19"; // mint(address,uint256)
    pub const BURN: &str = "42966c68"; // burn(uint256)
    pub const BURN_FROM: &str = "79cc6790"; // burnFrom(address,uint256)
    pub const PAUSE: &str = "8456cb59"; // pause()
    pub const UNPAUSE: &str = "3f4ba83a"; // unpause()
    pub const BLACKLIST: &str = "f9f92be4"; // blacklist(address)
    pub const ADD_BLACKLIST: &str = "44337ea1"; // addBlacklist(address)
    pub const PERMIT: &str = "d505accf"; // permit(address,address,uint256,uint256,uint8,bytes32,bytes32)
}

/// EVM opcodes of interest
mod opcodes {
    pub const DELEGATECALL: u8 = 0xf4;
    pub const SELFDESTRUCT: u8 = 0xff;
}

/// EIP-1167 minimal proxy prefix
const MINIMAL_PROXY_PREFIX: &str = "363d3d373d3d3d363d73";

/// Analyzes contract bytecode for patterns and capabilities
pub struct BytecodeAnalyzer;

impl BytecodeAnalyzer {
    pub fn new() -> Self {
        Self
    }

    /// Full bytecode analysis
    pub fn analyze(&self, bytecode: &str) -> BytecodeAnalysis {
        let bytecode = bytecode.trim_start_matches("0x");
        let size_bytes = bytecode.len() / 2;

        // Empty contract
        if size_bytes == 0 {
            return BytecodeAnalysis::default();
        }

        let complexity = Self::calculate_complexity(size_bytes);
        let (is_proxy, proxy_type) = self.detect_proxy(bytecode);
        let has_selfdestruct = self.has_opcode(bytecode, opcodes::SELFDESTRUCT);
        let has_delegatecall = self.has_opcode(bytecode, opcodes::DELEGATECALL);
        let has_fee_pattern = self.detect_fee_pattern(bytecode);

        BytecodeAnalysis {
            size_bytes,
            is_proxy,
            proxy_type,
            implementation_address: None, // Filled by caller via RPC
            has_selfdestruct,
            has_delegatecall,
            has_fee_pattern,
            complexity,
        }
    }

    /// Detect token capabilities from bytecode function selectors
    pub fn detect_capabilities(&self, bytecode: &str) -> TokenCapabilities {
        let bytecode = bytecode.trim_start_matches("0x").to_lowercase();

        TokenCapabilities {
            has_mint: bytecode.contains(capability_selectors::MINT),
            has_burn: bytecode.contains(capability_selectors::BURN)
                || bytecode.contains(capability_selectors::BURN_FROM),
            has_pause: bytecode.contains(capability_selectors::PAUSE)
                || bytecode.contains(capability_selectors::UNPAUSE),
            has_blacklist: bytecode.contains(capability_selectors::BLACKLIST)
                || bytecode.contains(capability_selectors::ADD_BLACKLIST),
            has_permit: bytecode.contains(capability_selectors::PERMIT),
            is_upgradeable: self.detect_proxy(&bytecode).0,
        }
    }

    /// Calculate complexity based on bytecode size
    fn calculate_complexity(size_bytes: usize) -> BytecodeComplexity {
        if size_bytes < 5 * 1024 {
            BytecodeComplexity::Simple
        } else if size_bytes < 15 * 1024 {
            BytecodeComplexity::Moderate
        } else {
            BytecodeComplexity::Complex
        }
    }

    /// Detect if contract is a proxy and what type
    fn detect_proxy(&self, bytecode: &str) -> (bool, Option<ProxyType>) {
        let bytecode_lower = bytecode.to_lowercase();

        // EIP-1167 minimal proxy (clone)
        if bytecode_lower.starts_with(MINIMAL_PROXY_PREFIX) {
            return (true, Some(ProxyType::MinimalProxy));
        }

        // Small bytecode with delegatecall is likely a proxy
        let size = bytecode.len() / 2;
        let has_delegatecall = self.has_opcode(&bytecode_lower, opcodes::DELEGATECALL);

        if has_delegatecall && size < 1000 {
            // EIP-1967 uses specific storage slot pattern
            // We can't detect slot usage from bytecode alone, but small + delegatecall = proxy
            return (true, Some(ProxyType::Eip1967));
        }

        // Larger contracts with delegatecall might be upgradeable
        if has_delegatecall && size < 5000 {
            return (true, Some(ProxyType::TransparentUpgradeable));
        }

        (false, None)
    }

    /// Check if bytecode contains a specific opcode
    fn has_opcode(&self, bytecode: &str, opcode: u8) -> bool {
        // Convert bytecode to bytes and scan for opcode
        // This is a simplified check - a full implementation would parse
        // the bytecode properly to avoid false positives from PUSH data
        let target = format!("{:02x}", opcode);

        // Simple heuristic: check if opcode appears in bytecode
        // Not perfect but good enough for risk assessment
        bytecode.to_lowercase().contains(&target)
    }

    /// Detect fee-on-transfer patterns via known function selectors
    /// Only checks for explicit fee setter functions to avoid false positives
    fn detect_fee_pattern(&self, bytecode: &str) -> bool {
        let bytecode_lower = bytecode.to_lowercase();

        // Look for common fee-related function selectors
        // setFee, setTaxFee, etc.
        let fee_selectors = [
            "69fe0e2d", // setFee(uint256)
            "c0b0fda2", // setTaxFee(uint256)
            "e01af92c", // setTaxRate(uint256)
            "f41e60c5", // setFees(uint256)
        ];

        for selector in fee_selectors {
            if bytecode_lower.contains(selector) {
                return true;
            }
        }

        false
    }
}

impl Default for BytecodeAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_minimal_proxy_detection() {
        let analyzer = BytecodeAnalyzer::new();
        // EIP-1167 minimal proxy bytecode prefix
        let proxy_bytecode = "363d3d373d3d3d363d73bebebebebebebebebebebebebebebebebebebebe5af43d82803e903d91602b57fd5bf3";
        let (is_proxy, proxy_type) = analyzer.detect_proxy(proxy_bytecode);
        assert!(is_proxy);
        assert_eq!(proxy_type, Some(ProxyType::MinimalProxy));
    }

    #[test]
    fn test_complexity_simple() {
        assert_eq!(
            BytecodeAnalyzer::calculate_complexity(1000),
            BytecodeComplexity::Simple
        );
    }

    #[test]
    fn test_complexity_moderate() {
        assert_eq!(
            BytecodeAnalyzer::calculate_complexity(8000),
            BytecodeComplexity::Moderate
        );
    }

    #[test]
    fn test_complexity_complex() {
        assert_eq!(
            BytecodeAnalyzer::calculate_complexity(20000),
            BytecodeComplexity::Complex
        );
    }
}
