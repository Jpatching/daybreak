mod cli;
mod types;
mod analyzers;
mod scoring;
mod report;
mod output;
mod commands;

use anyhow::Result;
use clap::Parser;
use cli::{Cli, Commands};

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Scan {
            address,
            chain,
            skip_holders,
            json,
        } => {
            commands::run_scan(
                &address,
                &chain,
                cli.rpc_url,
                cli.etherscan_key,
                skip_holders,
                json,
            )
            .await?;
        }
        Commands::Report {
            address,
            chain,
            output,
            skip_holders,
        } => {
            commands::run_report(
                &address,
                &chain,
                cli.rpc_url,
                cli.etherscan_key,
                &output,
                skip_holders,
            )
            .await?;
        }
        Commands::Compare {
            address,
            chain,
            json,
        } => {
            commands::run_compare(&address, &chain, cli.rpc_url, json).await?;
        }
    }

    Ok(())
}
