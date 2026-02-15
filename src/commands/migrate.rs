use anyhow::{bail, Context, Result};
use colored::Colorize;
use indicatif::{ProgressBar, ProgressStyle};
use solana_sdk::signature::{read_keypair_file, Signer};
use std::io::{self, Write};
use std::process::Command;
use std::time::Duration;

use crate::analyzers::{BridgeDetector, CompatibilityChecker, EvmAnalyzer};
use crate::report::NttConfigGenerator;
use crate::solana::SolanaDeployer;
use crate::types::{Chain, FullAnalysis};

/// Create a styled progress spinner
fn spinner(msg: &str) -> ProgressBar {
    let pb = ProgressBar::new_spinner();
    pb.set_style(
        ProgressStyle::default_spinner()
            .template("{spinner:.cyan} {msg}")
            .unwrap(),
    );
    pb.enable_steady_tick(Duration::from_millis(80));
    pb.set_message(msg.to_string());
    pb
}

/// Check that required CLI tools are available
fn check_prerequisites() -> Result<()> {
    // Check for ntt CLI
    let ntt_check = Command::new("ntt").arg("--version").output();
    if ntt_check.is_err() {
        bail!(
            "NTT CLI not found. Install it with:\n  {}",
            "npm install -g @wormhole-foundation/ntt-cli".cyan()
        );
    }

    // Check for solana CLI
    let solana_check = Command::new("solana").arg("--version").output();
    if solana_check.is_err() {
        bail!(
            "Solana CLI not found. Install it from:\n  {}",
            "https://docs.solana.com/cli/install-solana-cli-tools".cyan()
        );
    }

    Ok(())
}

/// Run the migrate command — end-to-end NTT orchestration
pub async fn run_migrate(
    address: &str,
    chain: &str,
    rpc_url: Option<String>,
    network: &str,
    keypair_path: &str,
    skip_ntt: bool,
) -> Result<()> {
    let chain: Chain = chain.parse()?;

    println!();
    println!("{}", "═".repeat(60).bright_blue());
    println!("{}", "  DAYBREAK — End-to-End NTT Migration".bold());
    println!("{}", "═".repeat(60).bright_blue());
    println!();

    // ── Step 1: Check prerequisites ──
    let pb = spinner("Checking prerequisites...");
    if !skip_ntt {
        match check_prerequisites() {
            Ok(()) => pb.finish_with_message("Prerequisites OK ✓".to_string()),
            Err(e) => {
                pb.finish_with_message("Prerequisites check failed ✗".to_string());
                eprintln!();
                eprintln!("  {} {}", "Error:".red().bold(), e);
                eprintln!();
                eprintln!(
                    "  {} Use {} to skip NTT CLI steps and just deploy the SPL token.",
                    "Tip:".yellow(),
                    "--skip-ntt".cyan()
                );
                return Err(e);
            }
        }
    } else {
        pb.finish_with_message("Prerequisites skipped (--skip-ntt) ✓".to_string());
    }

    // ── Step 2: Analyze token ──
    let pb = spinner("Analyzing EVM token...");
    let evm = EvmAnalyzer::new(chain, rpc_url);
    let token = evm.get_token_info(address).await?;
    let capabilities = evm.get_capabilities(address).await?;
    let bytecode = evm.analyze_bytecode(address).await?;
    let compatibility = CompatibilityChecker::check(&token, &capabilities, &bytecode);
    let bridge_detector = BridgeDetector::new();
    let bridge_status = bridge_detector.check(address, chain).await?;
    let risk_score = crate::scoring::RiskScorer::calculate(
        &token,
        &capabilities,
        &bytecode,
        &bridge_status,
        None,
    );
    pb.finish_with_message(format!(
        "Found {} ({}) — {} decimals ✓",
        token.name, token.symbol, token.decimals
    ));

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

    if !analysis.compatibility.is_compatible {
        println!();
        println!(
            "  {} {} is not compatible with NTT migration.",
            "✗".red().bold(),
            analysis.token.symbol.bold()
        );
        println!(
            "    Run {} for details.",
            format!(
                "daybreak scan {} --chain {}",
                address,
                chain.to_string().to_lowercase()
            )
            .cyan()
        );
        bail!("Token not compatible with NTT");
    }

    if analysis.bridge_status.already_on_solana {
        println!();
        println!(
            "  {} {} already exists on Solana via {}",
            "!".yellow().bold(),
            analysis.token.symbol.bold(),
            analysis
                .bridge_status
                .bridge_provider
                .as_deref()
                .unwrap_or("unknown bridge")
        );
        eprint!("  Continue anyway? [y/N] ");
        io::stderr().flush()?;
        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        if !input.trim().eq_ignore_ascii_case("y") {
            println!("  Aborted.");
            return Ok(());
        }
    }

    let spl_decimals = analysis.token.decimals.min(9);

    // ── Step 3: Deploy SPL token ──
    let pb = spinner("Loading Solana keypair...");
    let expanded_path = if keypair_path.starts_with("~/") {
        let home = std::env::var("HOME").context("HOME not set")?;
        keypair_path.replacen('~', &home, 1)
    } else {
        keypair_path.to_string()
    };
    let payer = read_keypair_file(&expanded_path)
        .map_err(|e| anyhow::anyhow!("Failed to load keypair from {}: {}", expanded_path, e))?;
    pb.finish_with_message(format!("Keypair loaded: {} ✓", payer.pubkey()));

    let deployer = SolanaDeployer::new(network);

    // Mainnet confirmation
    if deployer.is_mainnet() {
        eprint!(
            "\n  {} {} This will deploy to Solana {}. Proceed? [y/N] ",
            "⚠".yellow().bold(),
            "WARNING:".yellow().bold(),
            "MAINNET".red().bold()
        );
        io::stderr().flush()?;
        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        if !input.trim().eq_ignore_ascii_case("y") {
            println!("  Aborted.");
            return Ok(());
        }
    }

    let pb = spinner("Checking wallet balance...");
    let balance = deployer.get_balance(&payer.pubkey())?;
    if balance < 0.01 {
        pb.finish_with_message("Insufficient balance ✗".to_string());
        bail!(
            "Insufficient balance: {:.4} SOL. Need at least 0.01 SOL. {}",
            balance,
            if !deployer.is_mainnet() {
                "Run `solana airdrop 2` to fund your devnet wallet."
            } else {
                ""
            }
        );
    }
    pb.finish_with_message(format!("Balance: {:.4} SOL ✓", balance));

    let pb = spinner("Creating SPL token mint...");
    let result = deployer.create_spl_token(&payer, spl_decimals)?;
    let mint_str = result.mint_address.to_string();
    pb.finish_with_message(format!("SPL token created: {} ✓", mint_str));

    // Create metadata
    let pb = spinner("Creating on-chain metadata (Metaplex)...");
    match deployer.create_metadata(
        &payer,
        &result.mint_address,
        &analysis.token.name,
        &analysis.token.symbol,
    ) {
        Ok(_) => pb.finish_with_message(format!(
            "Metadata created: {} ({}) ✓",
            analysis.token.name, analysis.token.symbol
        )),
        Err(e) => pb.finish_with_message(format!("Metadata failed (non-blocking): {} ⚠", e)),
    }

    // ── Step 4: Write deployment.json ──
    let pb = spinner("Writing deployment.json...");
    let deployment_json = NttConfigGenerator::generate_deployment_json(&analysis)?;
    let config_path = "deployment.json";
    std::fs::write(config_path, &deployment_json)?;
    pb.finish_with_message("deployment.json written ✓".to_string());

    // ── Step 5: NTT CLI orchestration ──
    if !skip_ntt {
        let source_chain = analysis.token.chain.to_string().to_lowercase();
        let mode = analysis
            .compatibility
            .recommended_mode
            .to_string()
            .to_lowercase();

        // ntt init
        let pb = spinner("Initializing NTT project...");
        run_ntt_command(&["init"])?;
        pb.finish_with_message("NTT initialized ✓".to_string());

        // ntt add-chain source
        let pb = spinner(&format!("Adding source chain ({})...", source_chain));
        run_ntt_command(&[
            "add-chain",
            &source_chain,
            "--mode",
            &mode,
            "--token",
            address,
        ])?;
        pb.finish_with_message(format!("Source chain {} added ✓", source_chain));

        // ntt add-chain solana
        let pb = spinner("Adding Solana as destination...");
        run_ntt_command(&[
            "add-chain",
            "solana",
            "--mode",
            "burning",
            "--token",
            &mint_str,
            "--decimals",
            &spl_decimals.to_string(),
        ])?;
        pb.finish_with_message("Solana destination added ✓".to_string());

        // ntt push
        let pb = spinner("Deploying NTT contracts (this may take a few minutes)...");
        run_ntt_command(&["push"])?;
        pb.finish_with_message("NTT contracts deployed ✓".to_string());
    }

    // ── Step 6: Print summary ──
    println!();
    println!("{}", "═".repeat(60).bright_blue());
    println!("{}", "  Migration Complete!".green().bold());
    println!("{}", "═".repeat(60).bright_blue());
    println!();
    println!(
        "  Token:    {} ({})",
        analysis.token.name.bold(),
        analysis.token.symbol
    );
    println!("  Chain:    {} → Solana", analysis.token.chain);
    println!(
        "  Mode:     {} → Burning",
        analysis.compatibility.recommended_mode
    );
    println!("  SPL Mint: {}", mint_str.cyan());
    println!("  Network:  {}", network);
    println!("  Cost:     {:.5} SOL", result.cost_sol);
    println!();
    println!("  Explorer: {}", result.explorer_url().cyan());

    if skip_ntt {
        println!();
        println!("{}", "── Remaining Steps (NTT CLI) ──".bright_white());
        println!();
        let cli_commands = NttConfigGenerator::generate_cli_commands(&analysis);
        for cmd in &cli_commands {
            if cmd.starts_with('#') || cmd.is_empty() {
                println!("  {}", cmd.dimmed());
            } else {
                println!("  {}", cmd.cyan());
            }
        }
    } else {
        println!();
        println!("{}", "── Post-Migration ──".bright_white());
        println!();
        println!(
            "  {} Transfer mint authority to NTT manager:",
            "1.".bright_white()
        );
        println!(
            "     {}",
            format!(
                "spl-token authorize {} mint <NTT_MANAGER_ADDRESS>",
                mint_str
            )
            .cyan()
        );
        println!("  {} Test transfer:", "2.".bright_white());
        println!(
            "     {}",
            "ntt transfer --amount 1 --to <SOLANA_ADDRESS>".cyan()
        );
        println!("  {} Monitor bridge health:", "3.".bright_white());
        println!("     {}", format!("daybreak status {}", mint_str).cyan());
    }

    println!();
    println!(
        "  {} Apply for Sunrise listing: {}",
        "→".bright_white(),
        "https://www.sunrise.wtf".cyan()
    );
    println!();
    println!("{}", "═".repeat(60).bright_blue());

    Ok(())
}

/// Run an NTT CLI command, capturing output
fn run_ntt_command(args: &[&str]) -> Result<()> {
    let output = Command::new("ntt")
        .args(args)
        .output()
        .context("Failed to execute ntt CLI")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        bail!("ntt {} failed: {}", args.join(" "), stderr.trim());
    }

    Ok(())
}
