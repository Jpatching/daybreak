use anyhow::{bail, Context, Result};
use colored::Colorize;
use solana_sdk::signature::{read_keypair_file, Signer};
use std::io::{self, Write};

use crate::analyzers::{CompatibilityChecker, EvmAnalyzer};
use crate::solana::SolanaDeployer;
use crate::types::Chain;

/// Print a progress step to stderr
fn progress(msg: &str) {
    eprintln!("  {} {}", "→".dimmed(), msg.dimmed());
}

/// Run the deploy command
pub async fn run_deploy(
    address: &str,
    chain: &str,
    rpc_url: Option<String>,
    network: &str,
    keypair_path: &str,
    transfer_authority: Option<&str>,
) -> Result<()> {
    let chain: Chain = chain.parse()?;

    // Analyze the EVM token first
    eprintln!(
        "\n{} {} on {}\n",
        "Analyzing".bold(),
        &address[..std::cmp::min(10, address.len())].cyan(),
        chain.to_string().cyan()
    );

    let evm = EvmAnalyzer::new(chain, rpc_url);

    progress("Fetching token metadata...");
    let token = evm.get_token_info(address).await?;
    let capabilities = evm.get_capabilities(address).await?;
    let bytecode = evm.analyze_bytecode(address).await?;

    let compatibility = CompatibilityChecker::check(&token, &capabilities, &bytecode);

    eprintln!(
        "  {} Found: {} ({}) — {} decimals\n",
        "✓".green(),
        token.name.bold(),
        token.symbol,
        token.decimals
    );

    if !compatibility.is_compatible {
        bail!(
            "Token {} is not compatible with NTT migration. Run `daybreak scan` for details.",
            token.symbol
        );
    }

    // Calculate Solana decimals (capped at 9)
    let spl_decimals = token.decimals.min(9);

    // Mainnet confirmation
    let deployer = SolanaDeployer::new(network);
    if deployer.is_mainnet() {
        eprint!(
            "  {} {} This will deploy to Solana {}. Proceed? [y/N] ",
            "⚠".yellow().bold(),
            "WARNING:".yellow().bold(),
            "MAINNET".red().bold()
        );
        io::stderr().flush()?;
        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        if !input.trim().eq_ignore_ascii_case("y") {
            eprintln!("  Aborted.");
            return Ok(());
        }
    }

    // Load keypair
    // Expand ~ to home directory
    let expanded_path = if keypair_path.starts_with("~/") {
        let home = std::env::var("HOME").context("HOME not set")?;
        keypair_path.replacen('~', &home, 1)
    } else {
        keypair_path.to_string()
    };
    let payer = read_keypair_file(&expanded_path)
        .map_err(|e| anyhow::anyhow!("Failed to load keypair from {}: {}", expanded_path, e))?;

    // Check balance
    progress("Checking wallet balance...");
    let balance = deployer.get_balance(&payer.pubkey())?;
    if balance < 0.01 {
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
    eprintln!("  {} Balance: {:.4} SOL", "✓".green(), balance);

    // Deploy
    eprintln!();
    eprintln!(
        "{} SPL token on Solana {}...",
        "Creating".bold(),
        network.cyan()
    );

    let result = deployer.create_spl_token(&payer, spl_decimals)?;

    let mint_str = result.mint_address.to_string();

    // Create on-chain metadata so the token shows up in wallets (Phantom, Solflare, etc.)
    progress("Creating on-chain metadata (Metaplex)...");
    match deployer.create_metadata(&payer, &result.mint_address, &token.name, &token.symbol) {
        Ok(_sig) => {
            eprintln!(
                "  {} Metadata created: {} ({})",
                "✓".green(),
                token.name,
                token.symbol
            );
        }
        Err(e) => {
            eprintln!(
                "  {} Metadata creation failed: {} (token still usable)",
                "⚠".yellow(),
                e
            );
        }
    }

    // Transfer mint authority if requested
    if let Some(new_authority) = transfer_authority {
        progress("Transferring mint authority...");
        deployer.transfer_mint_authority(&payer, &result.mint_address, new_authority)?;
        eprintln!(
            "  {} Mint authority transferred to {}",
            "✓".green(),
            new_authority.cyan()
        );
    }

    // Print results
    println!();
    println!("{}", "═".repeat(60).bright_blue());
    println!("{}", " SPL Token Created".bold());
    println!("{}", "═".repeat(60).bright_blue());
    println!();
    println!("  {} Token mint created", "✅".green());
    println!("  Mint:     {}", mint_str.cyan());
    println!("  Tx:       {}", result.signature.to_string().dimmed());
    if token.decimals > 9 {
        println!(
            "  Decimals: {} {}",
            spl_decimals,
            format!("(trimmed from {})", token.decimals).yellow()
        );
    } else {
        println!("  Decimals: {}", spl_decimals);
    }
    println!("  Network:  {}", network);
    println!("  Cost:     {:.5} SOL", result.cost_sol);
    println!("  Explorer: {}", result.explorer_url().cyan());

    // Post-deploy instructions
    println!();
    println!("{}", "── Post-Deploy Steps ──".bright_white());
    println!();

    if transfer_authority.is_some() {
        println!("  {} Mint authority already transferred", "✓".green());
    } else {
        println!(
            "  {} Transfer mint authority to NTT manager (required for bridging):",
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
    }
    println!(
        "  {} Initialize NTT with this token:",
        if transfer_authority.is_some() {
            "1."
        } else {
            "2."
        }
        .bright_white()
    );
    println!("     {}", "ntt init".cyan());
    let step_base = if transfer_authority.is_some() { 2 } else { 3 };
    println!(
        "  {} Add source chain:",
        format!("{}.", step_base).bright_white()
    );
    println!(
        "     {}",
        format!(
            "ntt add-chain {} --mode {} --token {}",
            chain.to_string().to_lowercase(),
            compatibility.recommended_mode.to_string().to_lowercase(),
            address
        )
        .cyan()
    );
    println!(
        "  {} Add Solana as destination:",
        format!("{}.", step_base + 1).bright_white()
    );
    println!(
        "     {}",
        format!(
            "ntt add-chain solana --mode burning --token {} --decimals {}",
            mint_str, spl_decimals
        )
        .cyan()
    );
    println!(
        "  {} Deploy NTT contracts:",
        format!("{}.", step_base + 2).bright_white()
    );
    println!("     {}", "ntt deploy".cyan());
    println!(
        "  {} Test transfer:",
        format!("{}.", step_base + 3).bright_white()
    );
    println!(
        "     {}",
        "ntt transfer --amount 1 --to <SOLANA_ADDRESS>".cyan()
    );

    println!();
    if transfer_authority.is_none() {
        println!(
            "  {} {}",
            "⚠".yellow(),
            "NTT manager needs mint authority to mint bridged tokens on Solana.".yellow()
        );
        println!(
            "    {}",
            "Deploy NTT first to get the manager address, then transfer authority.".dimmed()
        );
        println!();
    }
    println!(
        "  {} Apply for Sunrise listing: {}",
        "→".bright_white(),
        "https://www.sunrise.wtf".cyan()
    );
    println!();
    println!("{}", "═".repeat(60).bright_blue());

    Ok(())
}
