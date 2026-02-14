use anyhow::Result;
use crate::analyzers::{BridgeDetector, CompatibilityChecker, EvmAnalyzer, HolderAnalyzer};
use crate::output::{JsonOutput, TerminalOutput};
use crate::scoring::RiskScorer;
use crate::types::{Chain, FullAnalysis};

/// Run the scan command
pub async fn run_scan(
    address: &str,
    chain: &str,
    rpc_url: Option<String>,
    etherscan_key: Option<String>,
    skip_holders: bool,
    json_output: bool,
) -> Result<()> {
    let chain: Chain = chain.parse()?;

    // Initialize analyzers
    let evm = EvmAnalyzer::new(chain, rpc_url);
    let bridge_detector = BridgeDetector::new();
    let holder_analyzer = HolderAnalyzer::new(etherscan_key);

    // Fetch token info
    let token = evm.get_token_info(address).await?;
    let capabilities = evm.get_capabilities(address).await?;
    let bytecode = evm.analyze_bytecode(address).await?;

    // Check compatibility
    let compatibility = CompatibilityChecker::check(&token, &capabilities, &bytecode);

    // Check existing bridges
    let bridge_status = bridge_detector.check(address, chain).await?;

    // Fetch holder data (optional)
    let holder_data = if !skip_holders {
        holder_analyzer.get_holders(address, chain).await.ok()
    } else {
        None
    };

    // Calculate risk score
    let risk_score = RiskScorer::calculate(
        &token,
        &capabilities,
        &bytecode,
        &bridge_status,
        holder_data.as_ref(),
    );

    let analysis = FullAnalysis {
        token,
        capabilities,
        bytecode,
        compatibility,
        bridge_status,
        risk_score,
        holder_data,
    };

    // Output
    if json_output {
        println!("{}", JsonOutput::format_analysis(&analysis)?);
    } else {
        TerminalOutput::print_scan(&analysis);
    }

    Ok(())
}
