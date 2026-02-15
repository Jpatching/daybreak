use anyhow::{Context, Result};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    commitment_config::CommitmentConfig,
    program_pack::Pack,
    pubkey::Pubkey,
    signature::{Keypair, Signature, Signer},
    system_instruction,
    transaction::Transaction,
};
use spl_token::state::Mint;

/// Result of deploying an SPL token
#[derive(Debug, Clone)]
pub struct DeployResult {
    pub mint_address: Pubkey,
    pub signature: Signature,
    pub cost_sol: f64,
    pub network: String,
}

impl DeployResult {
    /// Returns the Solana Explorer URL for the mint address
    pub fn explorer_url(&self) -> String {
        if self.network == "mainnet" {
            format!("https://explorer.solana.com/address/{}", self.mint_address)
        } else {
            format!(
                "https://explorer.solana.com/address/{}?cluster={}",
                self.mint_address, self.network
            )
        }
    }
}

/// Handles SPL token deployment on Solana
pub struct SolanaDeployer {
    client: RpcClient,
    network: String,
}

impl SolanaDeployer {
    pub fn new(network: &str) -> Self {
        let url = match network {
            "mainnet" => "https://api.mainnet-beta.solana.com",
            _ => "https://api.devnet.solana.com",
        };
        Self {
            client: RpcClient::new_with_commitment(url, CommitmentConfig::confirmed()),
            network: network.to_string(),
        }
    }

    /// Create an SPL token mint matching the EVM token specs
    pub fn create_spl_token(&self, payer: &Keypair, decimals: u8) -> Result<DeployResult> {
        // Cap decimals at 9 (SPL max)
        let spl_decimals = decimals.min(9);

        let mint_keypair = Keypair::new();
        let mint_pubkey = mint_keypair.pubkey();

        // Get rent exemption for a Mint account
        let mint_rent = self
            .client
            .get_minimum_balance_for_rent_exemption(Mint::LEN)
            .context("Failed to get rent exemption — is the Solana RPC reachable?")?;

        let create_account_ix = system_instruction::create_account(
            &payer.pubkey(),
            &mint_pubkey,
            mint_rent,
            Mint::LEN as u64,
            &spl_token::id(),
        );

        let init_mint_ix = spl_token::instruction::initialize_mint2(
            &spl_token::id(),
            &mint_pubkey,
            &payer.pubkey(),       // mint authority
            Some(&payer.pubkey()), // freeze authority
            spl_decimals,
        )?;

        let recent_blockhash = self
            .client
            .get_latest_blockhash()
            .context("Failed to get recent blockhash")?;

        let tx = Transaction::new_signed_with_payer(
            &[create_account_ix, init_mint_ix],
            Some(&payer.pubkey()),
            &[payer, &mint_keypair],
            recent_blockhash,
        );

        let signature = self
            .client
            .send_and_confirm_transaction(&tx)
            .context("Transaction failed — do you have enough SOL?")?;

        let cost_sol = mint_rent as f64 / 1_000_000_000.0;

        Ok(DeployResult {
            mint_address: mint_pubkey,
            signature,
            cost_sol,
            network: self.network.clone(),
        })
    }

    /// Check payer balance
    pub fn get_balance(&self, pubkey: &Pubkey) -> Result<f64> {
        let lamports = self.client.get_balance(pubkey)?;
        Ok(lamports as f64 / 1_000_000_000.0)
    }

    pub fn is_mainnet(&self) -> bool {
        self.network == "mainnet"
    }
}
