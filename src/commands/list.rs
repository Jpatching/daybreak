use anyhow::Result;
use colored::Colorize;
use serde::Serialize;
use std::time::Duration;
use tokio::time::sleep;

use crate::analyzers::{BridgeDetector, CompatibilityChecker, EvmAnalyzer};
use crate::scoring::RiskScorer;
use crate::types::{Chain, FullAnalysis};

/// A curated token entry for the list scan
struct TokenEntry {
    symbol: &'static str,
    address: &'static str,
}

/// Curated list of high-value ERC-20 tokens to scan
const TOKEN_LIST: &[TokenEntry] = &[
    // Discovery targets — not yet natively on Solana
    TokenEntry {
        symbol: "ONDO",
        address: "0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3",
    },
    TokenEntry {
        symbol: "AAVE",
        address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
    },
    TokenEntry {
        symbol: "UNI",
        address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    },
    TokenEntry {
        symbol: "LINK",
        address: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    },
    TokenEntry {
        symbol: "CRV",
        address: "0xD533a949740bb3306d119CC777fa900bA034cd52",
    },
    TokenEntry {
        symbol: "COMP",
        address: "0xc00e94Cb662C3520282E6f5717214004A7f26888",
    },
    TokenEntry {
        symbol: "SNX",
        address: "0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F",
    },
    TokenEntry {
        symbol: "LDO",
        address: "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32",
    },
    TokenEntry {
        symbol: "ENS",
        address: "0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72",
    },
    TokenEntry {
        symbol: "RPL",
        address: "0xD33526068D116cE69F19A9ee46F0bd304F21A51f",
    },
    TokenEntry {
        symbol: "FXS",
        address: "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0",
    },
    TokenEntry {
        symbol: "BAL",
        address: "0xba100000625a3754423978a60c9317c58a424e3D",
    },
    TokenEntry {
        symbol: "GRT",
        address: "0xc944E90C64B2c07662A292be6244BDf05Cda44a7",
    },
    TokenEntry {
        symbol: "DYDX",
        address: "0x92D6C1e31e14520e676a687F0a93788B716BEff5",
    },
    TokenEntry {
        symbol: "PENDLE",
        address: "0x808507121B80c02388fAd14726482e061B8da827",
    },
    // Already on Solana — included for contrast
    TokenEntry {
        symbol: "USDC",
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    },
    TokenEntry {
        symbol: "USDT",
        address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    },
    TokenEntry {
        symbol: "DAI",
        address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    },
];

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

/// Run the list command — scan curated tokens and display a ranked table
pub async fn run_list(
    chain: &str,
    rpc_url: Option<String>,
    limit: Option<usize>,
    json_output: bool,
) -> Result<()> {
    let chain: Chain = chain.parse()?;

    let tokens: &[TokenEntry] = match limit {
        Some(n) => &TOKEN_LIST[..n.min(TOKEN_LIST.len())],
        None => TOKEN_LIST,
    };

    eprintln!(
        "\n{} {} tokens on {}...\n",
        "Analyzing".bold(),
        tokens.len(),
        chain.to_string().cyan()
    );

    let evm = EvmAnalyzer::new(chain, rpc_url);
    let bridge_detector = BridgeDetector::new();

    let mut rows: Vec<ListRow> = Vec::new();

    for (i, entry) in tokens.iter().enumerate() {
        eprintln!(
            "  {} [{}/{}] Analyzing {} ({}...)",
            "→".dimmed(),
            i + 1,
            tokens.len(),
            entry.symbol.cyan(),
            &entry.address[..10],
        );

        match analyze_token(&evm, &bridge_detector, entry.address, chain).await {
            Ok(analysis) => {
                rows.push(ListRow {
                    symbol: analysis.token.symbol.clone(),
                    address: entry.address.to_string(),
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
        if i + 1 < tokens.len() {
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
