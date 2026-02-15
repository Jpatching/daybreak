use crate::analyzers::{BridgeDetector, CompatibilityChecker, EvmAnalyzer};
use crate::output::{JsonOutput, TerminalOutput};
use crate::report::PathComparator;
use crate::scoring::RiskScorer;
use crate::types::{Chain, FullAnalysis};
use anyhow::Result;

/// Run the compare command
pub async fn run_compare(
    address: &str,
    chain: &str,
    rpc_url: Option<String>,
    json_output: bool,
) -> Result<()> {
    let chain: Chain = chain.parse()?;

    // Initialize analyzers
    let evm = EvmAnalyzer::new(chain, rpc_url);
    let bridge_detector = BridgeDetector::new();

    // Fetch token info
    let token = evm.get_token_info(address).await?;
    let capabilities = evm.get_capabilities(address).await?;
    let bytecode = evm.analyze_bytecode(address).await?;

    // Check compatibility
    let compatibility = CompatibilityChecker::check(&token, &capabilities, &bytecode);

    // Check existing bridges
    let bridge_status = bridge_detector.check(address, chain).await?;

    // Calculate risk score (no holder data for compare)
    let risk_score = RiskScorer::calculate(&token, &capabilities, &bytecode, &bridge_status, None);

    let analysis = FullAnalysis {
        token,
        capabilities,
        bytecode,
        compatibility,
        bridge_status,
        risk_score,
        holder_data: None,
        rate_limit: None,
    };

    // Compare paths
    let paths = PathComparator::compare(&analysis);

    // Output
    if json_output {
        println!("{}", JsonOutput::format_comparison(&paths)?);
    } else {
        TerminalOutput::print_comparison(&paths);
    }

    Ok(())
}
