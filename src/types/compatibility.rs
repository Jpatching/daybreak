use serde::{Deserialize, Serialize};

/// Severity level for compatibility issues
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum IssueSeverity {
    /// Informational only, no action needed
    Info,
    /// Should be addressed but not blocking
    Warning,
    /// Must be resolved before migration
    Error,
}

impl std::fmt::Display for IssueSeverity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            IssueSeverity::Info => write!(f, "INFO"),
            IssueSeverity::Warning => write!(f, "WARNING"),
            IssueSeverity::Error => write!(f, "ERROR"),
        }
    }
}

/// A specific compatibility issue detected
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompatibilityIssue {
    pub severity: IssueSeverity,
    pub code: String,
    pub title: String,
    pub description: String,
    pub recommendation: String,
}

/// NTT transfer mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NttMode {
    /// Lock tokens on source, mint on destination
    Locking,
    /// Burn tokens on source, mint on destination
    Burning,
}

impl std::fmt::Display for NttMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            NttMode::Locking => write!(f, "Locking"),
            NttMode::Burning => write!(f, "Burning"),
        }
    }
}

/// Overall NTT compatibility assessment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompatibilityResult {
    pub is_compatible: bool,
    pub recommended_mode: NttMode,
    pub issues: Vec<CompatibilityIssue>,
    pub decimal_trimming_required: bool,
    pub solana_decimals: u8,
}

impl CompatibilityResult {
    pub fn error_count(&self) -> usize {
        self.issues
            .iter()
            .filter(|i| i.severity == IssueSeverity::Error)
            .count()
    }

    pub fn warning_count(&self) -> usize {
        self.issues
            .iter()
            .filter(|i| i.severity == IssueSeverity::Warning)
            .count()
    }
}

/// Existing bridge detection results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeStatus {
    pub already_on_solana: bool,
    pub solana_address: Option<String>,
    pub bridge_provider: Option<String>,
    pub wormhole_attested: bool,
}

impl Default for BridgeStatus {
    fn default() -> Self {
        Self {
            already_on_solana: false,
            solana_address: None,
            bridge_provider: None,
            wormhole_attested: false,
        }
    }
}
