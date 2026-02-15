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

/// How a token is bridged to Solana — the key Sunrise distinction
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BridgeType {
    /// Wormhole Portal wrapped token (synthetic wToken)
    Portal,
    /// Wormhole NTT via Sunrise (native SPL)
    Ntt,
    /// Natively issued on Solana (e.g., USDC by Circle)
    Native,
}

impl std::fmt::Display for BridgeType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BridgeType::Portal => write!(f, "Portal (Wrapped)"),
            BridgeType::Ntt => write!(f, "NTT (Native via Sunrise)"),
            BridgeType::Native => write!(f, "Native"),
        }
    }
}

/// Existing bridge detection results
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BridgeStatus {
    pub already_on_solana: bool,
    pub solana_address: Option<String>,
    pub bridge_provider: Option<String>,
    pub bridge_type: Option<BridgeType>,
    pub wormhole_attested: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bridge_type_display() {
        assert_eq!(BridgeType::Portal.to_string(), "Portal (Wrapped)");
        assert_eq!(BridgeType::Ntt.to_string(), "NTT (Native via Sunrise)");
        assert_eq!(BridgeType::Native.to_string(), "Native");
    }

    #[test]
    fn test_bridge_status_default() {
        let status = BridgeStatus::default();
        assert!(!status.already_on_solana);
        assert!(status.solana_address.is_none());
        assert!(status.bridge_provider.is_none());
        assert!(status.bridge_type.is_none());
        assert!(!status.wormhole_attested);
    }

    #[test]
    fn test_ntt_mode_display() {
        assert_eq!(NttMode::Locking.to_string(), "Locking");
        assert_eq!(NttMode::Burning.to_string(), "Burning");
    }

    #[test]
    fn test_bridge_type_equality() {
        assert_eq!(BridgeType::Portal, BridgeType::Portal);
        assert_ne!(BridgeType::Portal, BridgeType::Ntt);
        assert_ne!(BridgeType::Ntt, BridgeType::Native);
    }

    #[test]
    fn test_bridge_status_serialization() {
        let status = BridgeStatus {
            already_on_solana: true,
            solana_address: Some("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v".to_string()),
            bridge_provider: Some("Native (USDC)".to_string()),
            bridge_type: Some(BridgeType::Native),
            wormhole_attested: false,
        };
        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"already_on_solana\":true"));
        assert!(json.contains("\"bridge_type\":\"Native\""));

        // Roundtrip
        let deserialized: BridgeStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.bridge_type, Some(BridgeType::Native));
        assert!(deserialized.already_on_solana);
    }

    #[test]
    fn test_ntt_mode_pairing_rule() {
        // NTT mode pairing: if source is Locking, destination MUST be Burning
        // This is a documentation test for the core NTT invariant
        let source_mode = NttMode::Locking;
        let dest_mode = NttMode::Burning;
        assert_ne!(source_mode, dest_mode);

        // If source is Burning, destination is also Burning
        let source_mode2 = NttMode::Burning;
        let dest_mode2 = NttMode::Burning;
        assert_eq!(source_mode2, dest_mode2);
    }
}
