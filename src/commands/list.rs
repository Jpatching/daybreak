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

/// Curated list of high-value ERC-20 tokens to scan.
/// Sorted roughly by market cap. Includes both migration candidates
/// (not on Solana) and existing Solana tokens (for contrast).
const TOKEN_LIST: &[TokenEntry] = &[
    // ── Migration candidates — not yet natively on Solana ──
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
        symbol: "MKR",
        address: "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2",
    },
    TokenEntry {
        symbol: "LDO",
        address: "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32",
    },
    TokenEntry {
        symbol: "CRV",
        address: "0xD533a949740bb3306d119CC777fa900bA034cd52",
    },
    TokenEntry {
        symbol: "APE",
        address: "0x4d224452801ACEd8B2F0aebE155379bb5D594381",
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
        symbol: "ENS",
        address: "0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72",
    },
    TokenEntry {
        symbol: "DYDX",
        address: "0x92D6C1e31e14520e676a687F0a93788B716BEff5",
    },
    TokenEntry {
        symbol: "PENDLE",
        address: "0x808507121B80c02388fAd14726482e061B8da827",
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
        symbol: "1INCH",
        address: "0x111111111117dC0aa78b770fA6A738034120C302",
    },
    TokenEntry {
        symbol: "SUSHI",
        address: "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2",
    },
    TokenEntry {
        symbol: "YFI",
        address: "0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e",
    },
    TokenEntry {
        symbol: "ANKR",
        address: "0x8290333ceF9e6D528dD5618Fb97a76f268f3EDD4",
    },
    TokenEntry {
        symbol: "BLUR",
        address: "0x5283D291DBCF85356A21bA090E6db59121208b44",
    },
    TokenEntry {
        symbol: "CVX",
        address: "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B",
    },
    TokenEntry {
        symbol: "LQTY",
        address: "0x6DEA81C8171D0bA574754EF6F8b412F2Ed88c54D",
    },
    TokenEntry {
        symbol: "CELR",
        address: "0x4F9254C83EB525f9FCf346490bbb3ed28a81C667",
    },
    TokenEntry {
        symbol: "MASK",
        address: "0x69af81e73A73B40adF4f3d4223Cd9b1ECE623074",
    },
    TokenEntry {
        symbol: "BAND",
        address: "0xBA11D00c5f74255f56a5E366F4F77f5A186d7f55",
    },
    TokenEntry {
        symbol: "AUDIO",
        address: "0x18aAA7115705e8be94bfFEBDE57Af9BFc265B998",
    },
    TokenEntry {
        symbol: "NMR",
        address: "0x1776e1F26f98b1A5dF9cD347953a26dd3Cb46671",
    },
    TokenEntry {
        symbol: "PERP",
        address: "0xbC396689893D065F41bc2C6EcbeE5e0085233447",
    },
    TokenEntry {
        symbol: "SPELL",
        address: "0x090185f2135308BaD17527004364eBcC2D37e5F6",
    },
    TokenEntry {
        symbol: "ALCX",
        address: "0xdBdb4d16EdA451D0503b854CF79D55697F90c8DF",
    },
    TokenEntry {
        symbol: "REN",
        address: "0x408e41876cCCDC0F92210600ef50372656052a38",
    },
    TokenEntry {
        symbol: "BADGER",
        address: "0x3472A5A71965499acd81997a54BBA8D852C6E53d",
    },
    TokenEntry {
        symbol: "MPL",
        address: "0x33349B282065b0284d756F0577FB39c158F935e6",
    },
    TokenEntry {
        symbol: "POND",
        address: "0x57B946008913B82E4dF85f501cbAeD910e58D26C",
    },
    TokenEntry {
        symbol: "TRIBE",
        address: "0xc7283b66Eb1EB5FB86327f08e1B5816b0720212B",
    },
    TokenEntry {
        symbol: "LOOKS",
        address: "0xf4d2888d29D722226FafA5d9B24F9164c092421E",
    },
    TokenEntry {
        symbol: "HIGH",
        address: "0x71Ab77b7dbB4fa7e017BC15090b2163221420282",
    },
    TokenEntry {
        symbol: "AURA",
        address: "0xC0c293ce456fF0ED870ADd98a0828Dd4d2903DBF",
    },
    TokenEntry {
        symbol: "INST",
        address: "0x6f40d4A6237C257fff2dB00FA0510DeEECd303eb",
    },
    TokenEntry {
        symbol: "UMA",
        address: "0x04Fa0d235C4abf4BcF4787aF4CF447DE572eF828",
    },
    TokenEntry {
        symbol: "BTRFLY",
        address: "0xc55126051B22eBb829D00368f4B12Bde432de5Da",
    },
    TokenEntry {
        symbol: "KP3R",
        address: "0x1cEB5cB57C4D4E2b2433641b95Dd330A33185A44",
    },
    TokenEntry {
        symbol: "ROOK",
        address: "0xfA5047c9c78B8877af97BDcb85Db743fD7313d4a",
    },
    TokenEntry {
        symbol: "MCB",
        address: "0x4e352cF164E64ADCBad318C3a1e222E9EBa4Ce42",
    },
    TokenEntry {
        symbol: "IDLE",
        address: "0x875773784Af8135eA0ef43b5a374AaD105c5D39e",
    },
    TokenEntry {
        symbol: "FLX",
        address: "0x6243d8CEA23066d098a15582d81a598b4e8391F4",
    },
    TokenEntry {
        symbol: "INDEX",
        address: "0x0954906da0Bf32d5479e25f46056d22f08464cab",
    },
    TokenEntry {
        symbol: "CREAM",
        address: "0x2ba592F78dB6436527729929AAf6c908497cB200",
    },
    // ── Already on Solana — included for contrast ──
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
    TokenEntry {
        symbol: "WETH",
        address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    },
    TokenEntry {
        symbol: "WBTC",
        address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
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
