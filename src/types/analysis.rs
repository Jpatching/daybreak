use serde::{Deserialize, Serialize};

/// Proxy contract types following EIP standards
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProxyType {
    /// EIP-1967 transparent proxy
    Eip1967,
    /// EIP-1822 UUPS proxy
    Eip1822,
    /// OpenZeppelin transparent proxy (older)
    TransparentUpgradeable,
    /// Minimal proxy (EIP-1167 clone)
    MinimalProxy,
    /// Unknown proxy pattern
    Unknown,
}

impl std::fmt::Display for ProxyType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProxyType::Eip1967 => write!(f, "EIP-1967"),
            ProxyType::Eip1822 => write!(f, "EIP-1822 (UUPS)"),
            ProxyType::TransparentUpgradeable => write!(f, "Transparent Upgradeable"),
            ProxyType::MinimalProxy => write!(f, "Minimal Proxy (Clone)"),
            ProxyType::Unknown => write!(f, "Unknown Proxy"),
        }
    }
}

/// Result of analyzing contract bytecode
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BytecodeAnalysis {
    pub size_bytes: usize,
    pub is_proxy: bool,
    pub proxy_type: Option<ProxyType>,
    pub implementation_address: Option<String>,
    pub has_selfdestruct: bool,
    pub has_delegatecall: bool,
    pub has_fee_pattern: bool,
    pub complexity: BytecodeComplexity,
}

impl Default for BytecodeAnalysis {
    fn default() -> Self {
        Self {
            size_bytes: 0,
            is_proxy: false,
            proxy_type: None,
            implementation_address: None,
            has_selfdestruct: false,
            has_delegatecall: false,
            has_fee_pattern: false,
            complexity: BytecodeComplexity::Simple,
        }
    }
}

/// Contract complexity rating based on bytecode size
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BytecodeComplexity {
    /// Less than 5KB
    Simple,
    /// 5KB - 15KB
    Moderate,
    /// Greater than 15KB
    Complex,
}

impl std::fmt::Display for BytecodeComplexity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BytecodeComplexity::Simple => write!(f, "Simple (<5KB)"),
            BytecodeComplexity::Moderate => write!(f, "Moderate (5-15KB)"),
            BytecodeComplexity::Complex => write!(f, "Complex (>15KB)"),
        }
    }
}

/// Token holder distribution data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HolderData {
    pub top_holders: Vec<HolderInfo>,
    pub top_10_concentration: f64,
    pub total_holders: Option<u64>,
}

/// Individual holder information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HolderInfo {
    pub address: String,
    pub balance: String,
    pub percentage: f64,
}

/// Risk rating categories
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RiskRating {
    /// Score 0-33: Safe for migration
    Low,
    /// Score 34-66: Proceed with caution
    Medium,
    /// Score 67-100: Significant challenges
    High,
}

impl std::fmt::Display for RiskRating {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RiskRating::Low => write!(f, "Low"),
            RiskRating::Medium => write!(f, "Medium"),
            RiskRating::High => write!(f, "High"),
        }
    }
}

/// Individual risk score components
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskComponents {
    /// 0-20 points: >8 decimals adds complexity
    pub decimal_handling: u8,
    /// 0-25 points: fee-on-transfer, rebasing, etc.
    pub token_features: u8,
    /// 0-20 points: based on bytecode complexity
    pub bytecode_complexity: u8,
    /// 0-15 points: concentration risk
    pub holder_concentration: u8,
    /// 0-20 points: already bridged = coordination needed
    pub bridge_status: u8,
}

impl Default for RiskComponents {
    fn default() -> Self {
        Self {
            decimal_handling: 0,
            token_features: 0,
            bytecode_complexity: 0,
            holder_concentration: 0,
            bridge_status: 0,
        }
    }
}

/// Composite risk score for migration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskScore {
    /// Total score 0-100 (lower = safer)
    pub total: u8,
    pub rating: RiskRating,
    pub components: RiskComponents,
}

impl RiskScore {
    pub fn from_components(components: RiskComponents) -> Self {
        let total = components.decimal_handling
            + components.token_features
            + components.bytecode_complexity
            + components.holder_concentration
            + components.bridge_status;

        let total = total.min(100);

        let rating = if total <= 33 {
            RiskRating::Low
        } else if total <= 66 {
            RiskRating::Medium
        } else {
            RiskRating::High
        };

        Self {
            total,
            rating,
            components,
        }
    }
}
