use crate::types::{FullAnalysis, MigrationPath};
use anyhow::Result;

/// Handles JSON output formatting
pub struct JsonOutput;

impl JsonOutput {
    /// Output full analysis as JSON
    pub fn format_analysis(analysis: &FullAnalysis) -> Result<String> {
        serde_json::to_string_pretty(analysis).map_err(Into::into)
    }

    /// Output comparison as JSON
    pub fn format_comparison(paths: &[MigrationPath]) -> Result<String> {
        serde_json::to_string_pretty(paths).map_err(Into::into)
    }
}
