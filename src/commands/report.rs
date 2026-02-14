use anyhow::Result;
use std::path::Path;
use crate::analyzers::{BridgeDetector, CompatibilityChecker, EvmAnalyzer, HolderAnalyzer};
use crate::output::MarkdownGenerator;
use crate::report::{MigrationPlanGenerator, NttConfigGenerator};
use crate::scoring::RiskScorer;
use crate::types::{Chain, FullAnalysis};

/// Run the report command
pub async fn run_report(
    address: &str,
    chain: &str,
    rpc_url: Option<String>,
    etherscan_key: Option<String>,
    output_dir: &str,
    skip_holders: bool,
) -> Result<()> {
    let chain: Chain = chain.parse()?;
    let output_path = Path::new(output_dir);

    // Create output directory if needed
    tokio::fs::create_dir_all(output_path).await?;

    // Initialize analyzers
    let evm = EvmAnalyzer::new(chain, rpc_url);
    let bridge_detector = BridgeDetector::new();
    let holder_analyzer = HolderAnalyzer::new(etherscan_key);

    println!("Analyzing token {}...", address);

    // Fetch token info
    let token = evm.get_token_info(address).await?;
    println!("  Found: {} ({})", token.name, token.symbol);

    let capabilities = evm.get_capabilities(address).await?;
    let bytecode = evm.analyze_bytecode(address).await?;
    println!("  Bytecode: {} bytes", bytecode.size_bytes);

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
        token: token.clone(),
        capabilities,
        bytecode,
        compatibility,
        bridge_status,
        risk_score,
        holder_data,
    };

    // Generate migration plan
    let plan = MigrationPlanGenerator::generate(&analysis);

    // Generate markdown report
    let report_content = MarkdownGenerator::generate(&analysis, &plan);
    let report_path = output_path.join("report.md");
    tokio::fs::write(&report_path, &report_content).await?;
    println!("  Generated: {}", report_path.display());

    // Generate deployment.json
    let deployment_json = NttConfigGenerator::generate_deployment_json(&analysis)?;
    let deployment_path = output_path.join("deployment.json");
    tokio::fs::write(&deployment_path, &deployment_json).await?;
    println!("  Generated: {}", deployment_path.display());

    // Generate CLI commands
    let commands = NttConfigGenerator::generate_cli_commands(&analysis);
    let commands_path = output_path.join("ntt-commands.sh");
    tokio::fs::write(&commands_path, commands.join("\n")).await?;
    println!("  Generated: {}", commands_path.display());

    println!();
    println!("Migration report generated successfully!");
    println!("  - report.md: Full migration guide");
    println!("  - deployment.json: NTT deployment config");
    println!("  - ntt-commands.sh: CLI commands to run");

    Ok(())
}
