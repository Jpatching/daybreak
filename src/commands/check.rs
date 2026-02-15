use anyhow::{Context, Result};
use colored::Colorize;
use solana_sdk::signature::read_keypair_file;
use solana_sdk::signer::Signer;
use std::process::Command;

use crate::analyzers::{CompatibilityChecker, EvmAnalyzer};
use crate::solana::SolanaDeployer;
use crate::types::Chain;

/// A single readiness check result
struct CheckItem {
    name: String,
    passed: bool,
    detail: String,
    fix: Option<String>,
}

/// Run the check command — pre-migration readiness checker
pub async fn run_check(
    address: &str,
    chain: &str,
    rpc_url: Option<String>,
    network: &str,
    keypair_path: &str,
) -> Result<()> {
    let chain: Chain = chain.parse()?;
    let mut checks: Vec<CheckItem> = Vec::new();

    println!();
    println!("{}", "═".repeat(60).bright_blue());
    println!("{}", " Pre-Migration Readiness Check".bold());
    println!("{}", "═".repeat(60).bright_blue());
    println!();

    // 1. Check Solana CLI
    let solana_installed = Command::new("solana").arg("--version").output().is_ok();
    checks.push(CheckItem {
        name: "Solana CLI installed".to_string(),
        passed: solana_installed,
        detail: if solana_installed {
            "solana CLI found in PATH".to_string()
        } else {
            "solana CLI not found".to_string()
        },
        fix: if solana_installed {
            None
        } else {
            Some("sh -c \"$(curl -sSfL https://release.anza.xyz/stable/install)\"".to_string())
        },
    });

    // 2. Check SPL Token CLI
    let spl_installed = Command::new("spl-token").arg("--version").output().is_ok();
    checks.push(CheckItem {
        name: "SPL Token CLI installed".to_string(),
        passed: spl_installed,
        detail: if spl_installed {
            "spl-token CLI found in PATH".to_string()
        } else {
            "spl-token CLI not found".to_string()
        },
        fix: if spl_installed {
            None
        } else {
            Some("cargo install spl-token-cli".to_string())
        },
    });

    // 3. Check NTT CLI
    let ntt_installed = Command::new("ntt").arg("--version").output().is_ok();
    checks.push(CheckItem {
        name: "NTT CLI installed".to_string(),
        passed: ntt_installed,
        detail: if ntt_installed {
            "ntt CLI found in PATH".to_string()
        } else {
            "ntt CLI not found (needed for bridge deployment)".to_string()
        },
        fix: if ntt_installed {
            None
        } else {
            Some("npm install -g @wormhole-foundation/ntt-cli".to_string())
        },
    });

    // 4. Check keypair exists and loads
    let expanded_path = if keypair_path.starts_with("~/") {
        let home = std::env::var("HOME").context("HOME not set")?;
        keypair_path.replacen('~', &home, 1)
    } else {
        keypair_path.to_string()
    };
    let keypair_result = read_keypair_file(&expanded_path);
    let keypair_ok = keypair_result.is_ok();
    checks.push(CheckItem {
        name: "Solana keypair loaded".to_string(),
        passed: keypair_ok,
        detail: if keypair_ok {
            format!("Loaded from {}", expanded_path)
        } else {
            format!("Failed to load from {}", expanded_path)
        },
        fix: if keypair_ok {
            None
        } else {
            Some("solana-keygen new -o ~/.config/solana/id.json".to_string())
        },
    });

    // 5. Check wallet balance (need ~2 SOL for NTT deployment)
    let min_balance = if network == "mainnet" { 2.0 } else { 0.5 };
    if let Ok(ref payer) = keypair_result {
        let deployer = SolanaDeployer::new(network);
        match deployer.get_balance(&payer.pubkey()) {
            Ok(balance) => {
                let enough = balance >= min_balance;
                checks.push(CheckItem {
                    name: format!("Wallet balance (>= {:.1} SOL)", min_balance),
                    passed: enough,
                    detail: format!("{:.4} SOL on {}", balance, network),
                    fix: if enough {
                        None
                    } else if network != "mainnet" {
                        Some(format!(
                            "solana airdrop 2 {} --url {}",
                            payer.pubkey(),
                            network
                        ))
                    } else {
                        Some("Fund your wallet with SOL".to_string())
                    },
                });
            }
            Err(e) => {
                checks.push(CheckItem {
                    name: format!("Wallet balance (>= {:.1} SOL)", min_balance),
                    passed: false,
                    detail: format!("Failed to check: {}", e),
                    fix: Some("Check your Solana RPC connection".to_string()),
                });
            }
        }
    }

    // 6. Analyze the EVM token
    eprintln!(
        "  {} Analyzing token on {}...",
        "→".dimmed(),
        chain.to_string().cyan()
    );
    let evm = EvmAnalyzer::new(chain, rpc_url);
    match evm.get_token_info(address).await {
        Ok(token) => {
            let capabilities = evm.get_capabilities(address).await?;
            let bytecode = evm.analyze_bytecode(address).await?;
            let compatibility = CompatibilityChecker::check(&token, &capabilities, &bytecode);

            checks.push(CheckItem {
                name: "Token found on EVM".to_string(),
                passed: true,
                detail: format!(
                    "{} ({}) — {} decimals",
                    token.name, token.symbol, token.decimals
                ),
                fix: None,
            });

            checks.push(CheckItem {
                name: "NTT compatible".to_string(),
                passed: compatibility.is_compatible,
                detail: if compatibility.is_compatible {
                    format!(
                        "Mode: {} → Burning (Solana), {} decimals on Solana",
                        compatibility.recommended_mode, compatibility.solana_decimals
                    )
                } else {
                    let errors: Vec<_> = compatibility
                        .issues
                        .iter()
                        .filter(|i| i.severity == crate::types::IssueSeverity::Error)
                        .map(|i| i.title.clone())
                        .collect();
                    format!("Blocked: {}", errors.join(", "))
                },
                fix: if compatibility.is_compatible {
                    None
                } else {
                    Some(format!(
                        "daybreak scan {} --chain {} for details",
                        address,
                        chain.to_string().to_lowercase()
                    ))
                },
            });
        }
        Err(e) => {
            checks.push(CheckItem {
                name: "Token found on EVM".to_string(),
                passed: false,
                detail: format!("Failed: {}", e),
                fix: Some("Verify the token address is correct".to_string()),
            });
        }
    }

    // Print results
    let total = checks.len();
    let passed = checks.iter().filter(|c| c.passed).count();

    for check in &checks {
        let icon = if check.passed {
            "PASS".green().bold()
        } else {
            "FAIL".red().bold()
        };
        println!("  [{}] {}", icon, check.name.bold());
        println!("         {}", check.detail.dimmed());
        if let Some(ref fix) = check.fix {
            println!("         Fix: {}", fix.cyan());
        }
    }

    // Summary
    println!();
    println!("{}", "─".repeat(60));

    let pct = (passed as f64 / total as f64 * 100.0) as u8;
    let summary = format!("{}/{} checks passed ({}%)", passed, total, pct);
    if passed == total {
        println!(
            "  {} {}",
            "Ready for migration!".green().bold(),
            summary.green()
        );
        println!();
        println!(
            "  Next step: {}",
            "daybreak report <ADDRESS> -o ./output".cyan()
        );
        println!("  Then run:  {}", "ntt init && ntt deploy".cyan());
    } else {
        println!(
            "  {} {}",
            "Not ready yet.".yellow().bold(),
            summary.yellow()
        );
        println!();
        println!(
            "  Fix the failing checks above, then re-run {}",
            "daybreak check".cyan()
        );
    }

    println!();
    println!("{}", "═".repeat(60).bright_blue());

    Ok(())
}
