use anyhow::{Context, Result};
use colored::Colorize;
use indicatif::{ProgressBar, ProgressStyle};
use reqwest::Client;
use serde::Deserialize;
use solana_client::rpc_client::RpcClient;
use solana_sdk::{commitment_config::CommitmentConfig, program_pack::Pack, pubkey::Pubkey};
use spl_token::state::Mint;
use std::str::FromStr;
use std::time::Duration;

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

/// SPL token on-chain info
struct SplTokenInfo {
    mint_address: String,
    decimals: u8,
    supply: u64,
    mint_authority: Option<String>,
    freeze_authority: Option<String>,
}

/// WormholeScan transfer summary
#[derive(Deserialize)]
struct WormholeTransfersResponse {
    operations: Option<Vec<WormholeOperation>>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct WormholeOperation {
    #[serde(rename = "sourceChain")]
    source_chain: Option<serde_json::Value>,
    #[serde(rename = "targetChain")]
    target_chain: Option<serde_json::Value>,
    status: Option<String>,
}

/// Run the status command — post-migration bridge health monitoring
pub async fn run_status(mint_address: &str, network: &str) -> Result<()> {
    println!();
    println!("{}", "═".repeat(60).bright_blue());
    println!("{}", "  DAYBREAK — Bridge Status Monitor".bold());
    println!("{}", "═".repeat(60).bright_blue());
    println!();

    // ── Step 1: Query Solana for SPL token info ──
    let pb = spinner("Querying Solana for token info...");
    let token_info = get_spl_token_info(mint_address, network)?;
    pb.finish_with_message("Token info retrieved ✓".to_string());

    // ── Step 2: Query WormholeScan for recent bridge activity ──
    let pb = spinner("Checking WormholeScan for bridge activity...");
    let transfers = get_wormhole_activity(mint_address).await;
    pb.finish_with_message("Bridge activity checked ✓".to_string());

    // ── Display results ──
    println!();
    println!("{}", "── SPL Token Info ──".bright_white());
    println!("  Mint:            {}", token_info.mint_address.cyan());
    println!("  Decimals:        {}", token_info.decimals);

    let supply_display = format_supply(token_info.supply, token_info.decimals);
    println!("  Supply:          {}", supply_display);

    if let Some(ref authority) = token_info.mint_authority {
        println!("  Mint Authority:  {}", authority.cyan());
    } else {
        println!(
            "  Mint Authority:  {} (cannot mint new tokens)",
            "None".yellow()
        );
    }

    if let Some(ref authority) = token_info.freeze_authority {
        println!("  Freeze Authority: {}", authority.cyan());
    }

    let explorer_url = if network == "mainnet" {
        format!(
            "https://explorer.solana.com/address/{}",
            token_info.mint_address
        )
    } else {
        format!(
            "https://explorer.solana.com/address/{}?cluster={}",
            token_info.mint_address, network
        )
    };
    println!("  Explorer:        {}", explorer_url.cyan());

    // NTT health indicators
    println!();
    println!("{}", "── NTT Bridge Health ──".bright_white());

    // Check if mint authority is set (needed for NTT to mint bridged tokens)
    if token_info.mint_authority.is_some() {
        println!(
            "  {} Mint authority assigned (NTT can mint bridged tokens)",
            "✓".green()
        );
    } else {
        println!(
            "  {} No mint authority — NTT cannot mint tokens. Was authority transferred?",
            "✗".red()
        );
    }

    // Supply check
    if token_info.supply > 0 {
        println!(
            "  {} Tokens in circulation (supply: {})",
            "✓".green(),
            supply_display
        );
    } else {
        println!(
            "  {} No tokens minted yet — bridge has not been used",
            "⚠".yellow()
        );
    }

    // Wormhole activity
    println!();
    println!("{}", "── Recent Bridge Transfers ──".bright_white());
    match transfers {
        Ok(ops) => {
            if ops.is_empty() {
                println!(
                    "  {} No recent transfers found on WormholeScan",
                    "·".dimmed()
                );
                println!(
                    "  {}",
                    "This could mean the token is newly deployed or uses a different bridge."
                        .dimmed()
                );
            } else {
                println!(
                    "  Found {} recent transfer{}",
                    ops.len().to_string().green(),
                    if ops.len() == 1 { "" } else { "s" }
                );
                for (i, op) in ops.iter().take(5).enumerate() {
                    let status = op.status.as_deref().unwrap_or("unknown");
                    let status_colored = match status {
                        "completed" => status.green().to_string(),
                        "pending" => status.yellow().to_string(),
                        _ => status.dimmed().to_string(),
                    };
                    println!("  {}. Status: {}", i + 1, status_colored);
                }
            }
        }
        Err(_) => {
            println!("  {} Could not reach WormholeScan API", "⚠".yellow());
            println!(
                "  {}",
                "Bridge transfer data unavailable. The API may be rate-limited.".dimmed()
            );
        }
    }

    // Summary verdict
    println!();
    println!("{}", "═".repeat(60).bright_blue());
    let has_authority = token_info.mint_authority.is_some();
    let has_supply = token_info.supply > 0;
    if has_authority && has_supply {
        println!("  \u{2705} Bridge appears healthy — tokens are flowing");
    } else if has_authority {
        println!("  \u{26a0}\u{fe0f} Bridge is configured but no tokens bridged yet");
    } else {
        println!("  \u{274c} Bridge may not be functional — check mint authority");
    }
    println!("{}", "═".repeat(60).bright_blue());
    println!();

    Ok(())
}

/// Fetch SPL token mint info from Solana RPC
fn get_spl_token_info(mint_address: &str, network: &str) -> Result<SplTokenInfo> {
    let url = match network {
        "mainnet" => "https://api.mainnet-beta.solana.com",
        _ => "https://api.devnet.solana.com",
    };

    let client = RpcClient::new_with_commitment(url, CommitmentConfig::confirmed());
    let pubkey = Pubkey::from_str(mint_address).context("Invalid Solana mint address")?;

    let account = client
        .get_account(&pubkey)
        .context("Token mint account not found — is the address correct?")?;

    let mint = Mint::unpack(&account.data)
        .context("Failed to parse mint account data — is this an SPL token?")?;

    let mint_authority: Option<Pubkey> = mint.mint_authority.into();
    let freeze_authority: Option<Pubkey> = mint.freeze_authority.into();

    Ok(SplTokenInfo {
        mint_address: mint_address.to_string(),
        decimals: mint.decimals,
        supply: mint.supply,
        mint_authority: mint_authority.map(|pk| pk.to_string()),
        freeze_authority: freeze_authority.map(|pk| pk.to_string()),
    })
}

/// Query WormholeScan for recent transfers involving this token
async fn get_wormhole_activity(address: &str) -> Result<Vec<WormholeOperation>> {
    let client = Client::builder().timeout(Duration::from_secs(10)).build()?;

    let url = format!(
        "https://api.wormholescan.io/api/v1/operations?address={}&limit=10",
        address
    );

    let resp = client.get(&url).send().await?;

    if !resp.status().is_success() {
        anyhow::bail!("WormholeScan API returned {}", resp.status());
    }

    let body: WormholeTransfersResponse = resp.json().await?;
    Ok(body.operations.unwrap_or_default())
}

/// Format raw supply with decimals
fn format_supply(raw_supply: u64, decimals: u8) -> String {
    if decimals == 0 {
        return format!("{}", raw_supply);
    }
    let divisor = 10u64.pow(decimals as u32);
    let whole = raw_supply / divisor;
    let frac = raw_supply % divisor;
    if frac == 0 {
        format!("{}", whole)
    } else {
        format!("{}.{}", whole, frac)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_supply_zero_decimals() {
        assert_eq!(format_supply(1000, 0), "1000");
    }

    #[test]
    fn test_format_supply_with_decimals() {
        assert_eq!(format_supply(1_000_000, 6), "1");
        assert_eq!(format_supply(1_500_000, 6), "1.500000");
    }

    #[test]
    fn test_format_supply_zero() {
        assert_eq!(format_supply(0, 6), "0");
    }

    #[test]
    fn test_format_supply_small_amount() {
        assert_eq!(format_supply(1, 6), "0.1");
    }
}
