use serde::{Deserialize, Serialize};

/// Available migration methods to Solana
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MigrationMethod {
    /// Wormhole Native Token Transfers via Sunrise
    NttSunrise,
    /// Deploy on Neon EVM (EVM compatibility layer on Solana)
    NeonEvm,
    /// Full native Solana rewrite
    NativeRewrite,
}

impl std::fmt::Display for MigrationMethod {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MigrationMethod::NttSunrise => write!(f, "NTT (Sunrise)"),
            MigrationMethod::NeonEvm => write!(f, "Neon EVM"),
            MigrationMethod::NativeRewrite => write!(f, "Native Rewrite"),
        }
    }
}

/// How suitable a migration path is for this token
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Feasibility {
    /// Best option for this token
    Recommended,
    /// Workable but not optimal
    Viable,
    /// Significant challenges or not suitable
    NotRecommended,
}

impl std::fmt::Display for Feasibility {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Feasibility::Recommended => write!(f, "Recommended"),
            Feasibility::Viable => write!(f, "Viable"),
            Feasibility::NotRecommended => write!(f, "Not Recommended"),
        }
    }
}

/// A potential migration path with analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationPath {
    pub method: MigrationMethod,
    pub feasibility: Feasibility,
    pub estimated_cost_usd: String,
    pub estimated_time: String,
    pub pros: Vec<String>,
    pub cons: Vec<String>,
}

/// Complete migration plan for a token
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationPlan {
    pub recommended_path: MigrationMethod,
    pub paths: Vec<MigrationPath>,
    pub steps: Vec<MigrationStep>,
    pub ntt_config: Option<NttDeploymentConfig>,
}

/// Individual step in the migration process
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationStep {
    pub order: u8,
    pub title: String,
    pub description: String,
    pub command: Option<String>,
}

/// NTT deployment configuration (generates deployment.json)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NttDeploymentConfig {
    pub network: NetworkConfig,
    pub tokens: TokensConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkConfig {
    pub source_chain: String,
    pub destination_chain: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokensConfig {
    pub source: SourceTokenConfig,
    pub destination: DestinationTokenConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceTokenConfig {
    pub address: String,
    pub mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DestinationTokenConfig {
    pub decimals: u8,
    pub mode: String,
}

/// Full analysis result combining all data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FullAnalysis {
    pub token: super::TokenInfo,
    pub capabilities: super::TokenCapabilities,
    pub bytecode: super::BytecodeAnalysis,
    pub compatibility: super::CompatibilityResult,
    pub bridge_status: super::BridgeStatus,
    pub risk_score: super::RiskScore,
    pub holder_data: Option<super::HolderData>,
    pub rate_limit: Option<crate::analyzers::volume::RateLimitRecommendation>,
}
