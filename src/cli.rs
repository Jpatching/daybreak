use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "daybreak")]
#[command(author = "Daybreak Team")]
#[command(version = "0.1.0")]
#[command(about = "Analyze EVM tokens for Solana migration via Wormhole NTT", long_about = None)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,

    /// Custom RPC URL (overrides default for chain)
    #[arg(long, global = true)]
    pub rpc_url: Option<String>,

    /// Etherscan API key for holder data
    #[arg(long, global = true, env = "ETHERSCAN_API_KEY")]
    pub etherscan_key: Option<String>,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Full token analysis with compatibility check and risk score
    Scan {
        /// Token contract address (0x...)
        #[arg(value_name = "ADDRESS")]
        address: String,

        /// Source chain
        #[arg(short, long, default_value = "ethereum")]
        chain: String,

        /// Skip holder data fetch (faster, no API key needed)
        #[arg(long)]
        skip_holders: bool,

        /// Output as JSON
        #[arg(long)]
        json: bool,
    },

    /// Generate migration report and deployment config
    Report {
        /// Token contract address (0x...)
        #[arg(value_name = "ADDRESS")]
        address: String,

        /// Source chain
        #[arg(short, long, default_value = "ethereum")]
        chain: String,

        /// Output directory for generated files
        #[arg(short, long, default_value = ".")]
        output: String,

        /// Skip holder data fetch
        #[arg(long)]
        skip_holders: bool,
    },

    /// Compare migration paths: NTT vs Neon EVM vs native rewrite
    Compare {
        /// Token contract address (0x...)
        #[arg(value_name = "ADDRESS")]
        address: String,

        /// Source chain
        #[arg(short, long, default_value = "ethereum")]
        chain: String,

        /// Output as JSON
        #[arg(long)]
        json: bool,
    },

    /// Deploy SPL token on Solana matching an EVM token
    Deploy {
        /// Token contract address (0x...)
        #[arg(value_name = "ADDRESS")]
        address: String,

        /// Source chain
        #[arg(short, long, default_value = "ethereum")]
        chain: String,

        /// Solana network: devnet or mainnet
        #[arg(long, default_value = "devnet")]
        network: String,

        /// Path to Solana keypair JSON file
        #[arg(long, default_value = "~/.config/solana/id.json")]
        keypair: String,

        /// Transfer mint authority to a specified address (for NTT manager)
        #[arg(long)]
        transfer_authority: Option<String>,
    },

    /// Discover migration-ready ERC-20 tokens for Solana
    List {
        /// Source chain
        #[arg(short, long, default_value = "ethereum")]
        chain: String,

        /// Limit number of tokens to scan
        #[arg(short, long)]
        limit: Option<usize>,

        /// Output as JSON
        #[arg(long)]
        json: bool,
    },
}
