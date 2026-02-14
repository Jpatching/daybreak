use crate::types::FullAnalysis;

/// Estimates migration and operational costs
pub struct CostEstimator;

#[derive(Debug, Clone)]
pub struct CostEstimate {
    pub deployment_cost_usd: f64,
    pub deployment_cost_sol: f64,
    pub per_transfer_cost_usd: f64,
    pub monthly_operational_usd: f64,
}

impl CostEstimator {
    /// Estimate NTT deployment costs
    pub fn estimate_ntt_costs(analysis: &FullAnalysis, sol_price: f64) -> CostEstimate {
        // Solana deployment costs (rent exemption)
        let sol_deployment = 2.5; // NTT manager + transceiver + token accounts

        // EVM deployment costs (gas)
        // Assuming ~2M gas at 30 gwei and $3000 ETH
        let evm_deployment_usd = match analysis.token.chain {
            crate::types::Chain::Ethereum => 180.0,  // Mainnet is expensive
            crate::types::Chain::Polygon => 0.50,    // Very cheap
            crate::types::Chain::Arbitrum => 5.0,    // L2 pricing
            crate::types::Chain::Optimism => 5.0,    // L2 pricing
            crate::types::Chain::Base => 2.0,        // L2 pricing
            crate::types::Chain::Avalanche => 3.0,
            crate::types::Chain::Bsc => 1.0,
        };

        let deployment_cost_sol = sol_deployment;
        let deployment_cost_usd = (sol_deployment * sol_price) + evm_deployment_usd;

        // Per-transfer costs
        // Wormhole: ~$0.05 relayer fee
        // Solana: ~0.000005 SOL tx fee
        // Source chain gas varies
        let per_transfer_cost_usd = 0.10;

        // Monthly operational (assuming relayer costs)
        let monthly_operational_usd = 50.0;

        CostEstimate {
            deployment_cost_usd,
            deployment_cost_sol,
            per_transfer_cost_usd,
            monthly_operational_usd,
        }
    }

    /// Format costs for display
    pub fn format_costs(estimate: &CostEstimate) -> String {
        format!(
            "Deployment: ~${:.0} ({:.2} SOL + EVM gas)\n\
             Per Transfer: ~${:.2}\n\
             Monthly Ops: ~${:.0}",
            estimate.deployment_cost_usd,
            estimate.deployment_cost_sol,
            estimate.per_transfer_cost_usd,
            estimate.monthly_operational_usd
        )
    }
}
