use crate::analyzers::{
    BridgeDetector, CompatibilityChecker, EvmAnalyzer, HolderAnalyzer, VolumeAnalyzer,
};
use crate::output::{JsonOutput, TerminalOutput};
use crate::scoring::RiskScorer;
use crate::types::{Chain, FullAnalysis};
use anyhow::Result;
use colored::Colorize;

/// Print a progress step to stderr (won't interfere with JSON output)
fn progress(msg: &str) {
    eprintln!("  {} {}", "→".dimmed(), msg.dimmed());
}

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

    eprintln!(
        "\n{} {} on {}\n",
        "Scanning".bold(),
        &address[..10].cyan(),
        chain.to_string().cyan()
    );

    // Initialize analyzers
    let evm = EvmAnalyzer::new(chain, rpc_url);
    let bridge_detector = BridgeDetector::new();
    let holder_analyzer = HolderAnalyzer::new(etherscan_key.clone());
    let volume_analyzer = VolumeAnalyzer::new(etherscan_key);

    // Fetch token info
    progress("Fetching token metadata...");
    let token = evm.get_token_info(address).await?;
    progress("Analyzing token capabilities...");
    let capabilities = evm.get_capabilities(address).await?;
    progress("Scanning bytecode for patterns...");
    let bytecode = evm.analyze_bytecode(address).await?;

    // Check compatibility
    progress("Checking NTT compatibility...");
    let compatibility = CompatibilityChecker::check(&token, &capabilities, &bytecode);

    // Check existing bridges
    progress("Searching for existing bridges...");
    let bridge_status = bridge_detector.check(address, chain).await?;

    // Fetch holder data (optional)
    let holder_data = if !skip_holders {
        progress("Fetching holder distribution...");
        holder_analyzer.get_holders(address, chain).await.ok()
    } else {
        None
    };

    // Fetch volume data for rate limit recommendations
    progress("Estimating transfer volume...");
    let rate_limit = volume_analyzer
        .analyze(address, chain, token.decimals, &token.total_supply)
        .await
        .ok();

    // Calculate risk score
    progress("Calculating risk score...");
    let risk_score = RiskScorer::calculate(
        &token,
        &capabilities,
        &bytecode,
        &bridge_status,
        holder_data.as_ref(),
    );

    eprintln!("  {} {}\n", "✓".green(), "Analysis complete.".green());

    let analysis = FullAnalysis {
        token,
        capabilities,
        bytecode,
        compatibility,
        bridge_status,
        risk_score,
        holder_data,
        rate_limit,
    };

    // Output
    if json_output {
        println!("{}", JsonOutput::format_analysis(&analysis)?);
    } else {
        TerminalOutput::print_scan(&analysis);
    }

    Ok(())
}
