use anyhow::Result;
use colored::Colorize;
use serde::Serialize;
use std::time::Duration;
use tokio::time::sleep;

use crate::analyzers::{BridgeDetector, CompatibilityChecker, EvmAnalyzer, TokenDiscovery};
use crate::scoring::RiskScorer;
use crate::types::{Chain, FullAnalysis};

/// Summary row for a scanned token
#[derive(Debug, Clone, Serialize)]
struct ListRow {
    symbol: String,
    address: String,
    decimals: u8,
    risk_score: u8,
    is_compatible: bool,
    recommended_mode: String,
    already_on_solana: bool,
    bridge_provider: Option<String>,
}

/// Run the list command — scan tokens and display a ranked table
pub async fn run_list(
    chain: &str,
    rpc_url: Option<String>,
    limit: Option<usize>,
    json_output: bool,
    discover: bool,
) -> Result<()> {
    let chain: Chain = chain.parse()?;
    let max_tokens = limit.unwrap_or(45);

    // Get token list — dynamic discovery or curated fallback
    let discovery = TokenDiscovery::new();
    let discovered = if discover {
        eprintln!(
            "\n{} Discovering migration candidates via CoinGecko...\n",
            "🔍".bold(),
        );
        discovery.discover(max_tokens).await
    } else {
        discovery.curated_fallback(max_tokens)
    };

    let source = if discover
        && discovered
            .first()
            .and_then(|t| t.market_cap_rank)
            .is_some()
    {
        "CoinGecko"
    } else {
        "curated list"
    };

    eprintln!(
        "{} {} tokens on {} (source: {})\n",
        "Analyzing".bold(),
        discovered.len(),
        chain.to_string().cyan(),
        source.dimmed()
    );

    let evm = EvmAnalyzer::new(chain, rpc_url);
    let bridge_detector = BridgeDetector::new();

    let mut rows: Vec<ListRow> = Vec::new();

    for (i, entry) in discovered.iter().enumerate() {
        eprintln!(
            "  {} [{}/{}] Analyzing {} ({}...)",
            "→".dimmed(),
            i + 1,
            discovered.len(),
            entry.symbol.cyan(),
            &entry.address[..10.min(entry.address.len())],
        );

        match analyze_token(&evm, &bridge_detector, &entry.address, chain).await {
            Ok(analysis) => {
                rows.push(ListRow {
                    symbol: analysis.token.symbol.clone(),
                    address: entry.address.clone(),
                    decimals: analysis.token.decimals,
                    risk_score: analysis.risk_score.total,
                    is_compatible: analysis.compatibility.is_compatible,
                    recommended_mode: analysis.compatibility.recommended_mode.to_string(),
                    already_on_solana: analysis.bridge_status.already_on_solana,
                    bridge_provider: analysis.bridge_status.bridge_provider.clone(),
                });
            }
            Err(e) => {
                eprintln!("    {} Failed: {}", "✗".red(), e);
            }
        }

        // Rate limiting for public RPCs
        if i + 1 < discovered.len() {
            sleep(Duration::from_millis(200)).await;
        }
    }

    eprintln!();

    // Sort: not-on-Solana first, then by risk score ascending
    rows.sort_by(|a, b| {
        a.already_on_solana
            .cmp(&b.already_on_solana)
            .then(a.risk_score.cmp(&b.risk_score))
    });

    if json_output {
        println!("{}", serde_json::to_string_pretty(&rows)?);
    } else {
        print_table(&rows);
    }

    Ok(())
}

/// Analyze a single token (like scan, but without holder data)
async fn analyze_token(
    evm: &EvmAnalyzer,
    bridge_detector: &BridgeDetector,
    address: &str,
    chain: Chain,
) -> Result<FullAnalysis> {
    let token = evm.get_token_info(address).await?;
    let capabilities = evm.get_capabilities(address).await?;
    let bytecode = evm.analyze_bytecode(address).await?;
    let compatibility = CompatibilityChecker::check(&token, &capabilities, &bytecode);
    let bridge_status = bridge_detector.check(address, chain).await?;
    let risk_score = RiskScorer::calculate(&token, &capabilities, &bytecode, &bridge_status, None);

    Ok(FullAnalysis {
        token,
        capabilities,
        bytecode,
        compatibility,
        bridge_status,
        risk_score,
        holder_data: None,
        rate_limit: None,
    })
}

/// Print the results as a formatted table
fn print_table(rows: &[ListRow]) {
    let header_line = "═".repeat(79);
    let divider = "─".repeat(79);

    println!("{}", header_line.bold());
    println!(
        "  {:<8} {:<10} {:<10} {:<12} {:<10} {}",
        "Symbol".bold(),
        "Decimals".bold(),
        "Risk".bold(),
        "Compatible".bold(),
        "Mode".bold(),
        "Status".bold(),
    );
    println!("{}", divider);

    let mut migration_ready = 0;

    for row in rows {
        let risk_str = format!("{}/100", row.risk_score);
        let risk_colored = match row.risk_score {
            0..=33 => risk_str.green(),
            34..=66 => risk_str.yellow(),
            _ => risk_str.red(),
        };

        let compat_str = if row.is_compatible {
            "✓".green()
        } else {
            "✗".red()
        };

        let mode_str = &row.recommended_mode;

        let status = if row.already_on_solana {
            let provider = row.bridge_provider.as_deref().unwrap_or("Unknown");
            format!("Already on Solana ({})", provider)
                .dimmed()
                .to_string()
        } else if !row.is_compatible {
            "Not on Solana — compatibility issues".red().to_string()
        } else if row.risk_score <= 33 {
            migration_ready += 1;
            "Not on Solana — strong candidate".green().to_string()
        } else if row.risk_score <= 66 {
            migration_ready += 1;
            "Not on Solana — viable".yellow().to_string()
        } else {
            "Not on Solana — high risk".red().to_string()
        };

        println!(
            "  {:<8} {:<10} {:<10} {:<12} {:<10} {}",
            row.symbol.bold(),
            row.decimals,
            risk_colored,
            compat_str,
            mode_str,
            status,
        );
    }

    println!("{}", header_line.bold());
    println!();

    if migration_ready > 0 {
        println!(
            "  Found {} {} ready for migration to Solana via NTT.",
            migration_ready.to_string().green().bold(),
            if migration_ready == 1 {
                "token"
            } else {
                "tokens"
            },
        );
    } else {
        println!("  No migration-ready tokens found.");
    }

    println!(
        "  Run {} for detailed analysis.\n",
        "daybreak scan <address>".cyan()
    );
}
