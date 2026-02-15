use crate::types::{
    CompatibilityResult, Feasibility, FullAnalysis, IssueSeverity, MigrationPath, RiskRating,
};
use colored::Colorize;

/// Handles colored terminal output
pub struct TerminalOutput;

impl TerminalOutput {
    /// Print scan results
    pub fn print_scan(analysis: &FullAnalysis) {
        Self::print_header(&format!(
            "{} ({}) on {}",
            analysis.token.name, analysis.token.symbol, analysis.token.chain
        ));

        // Token info section
        Self::print_section("Token Information");
        println!("  Address:      {}", analysis.token.address.cyan());
        println!("  Decimals:     {}", analysis.token.decimals);
        println!("  Total Supply: {}", analysis.token.total_supply);

        // Capabilities
        Self::print_section("Capabilities");
        Self::print_capability("Mintable", analysis.capabilities.has_mint);
        Self::print_capability("Burnable", analysis.capabilities.has_burn);
        Self::print_capability("Pausable", analysis.capabilities.has_pause);
        Self::print_capability("Blacklist", analysis.capabilities.has_blacklist);
        Self::print_capability("Permit (EIP-2612)", analysis.capabilities.has_permit);
        Self::print_capability("Upgradeable", analysis.capabilities.is_upgradeable);
        if analysis.capabilities.is_rebasing {
            println!(
                "  {:<18} {}",
                "Rebasing",
                "Yes ✗".red().bold()
            );
        }

        // Bytecode analysis
        Self::print_section("Bytecode Analysis");
        println!(
            "  Size:         {} bytes ({})",
            analysis.bytecode.size_bytes, analysis.bytecode.complexity
        );
        println!(
            "  Is Proxy:     {}",
            Self::bool_colored(analysis.bytecode.is_proxy)
        );
        if let Some(ref impl_addr) = analysis.bytecode.implementation_address {
            println!("  Implementation: {}", impl_addr.cyan());
        }
        Self::print_warning_item("Has selfdestruct", analysis.bytecode.has_selfdestruct);
        Self::print_warning_item("Fee-on-transfer pattern", analysis.bytecode.has_fee_pattern);

        // Bridge status
        Self::print_section("Bridge Status");
        if analysis.bridge_status.already_on_solana {
            println!("  {} Token already exists on Solana", "!".yellow().bold());
            if let Some(ref addr) = analysis.bridge_status.solana_address {
                println!("  Solana Address: {}", addr.cyan());
            }
            if let Some(ref provider) = analysis.bridge_status.bridge_provider {
                println!("  Bridge: {}", provider);
            }
        } else {
            println!("  {} No existing Solana presence", "✓".green());
        }

        // Holder distribution
        Self::print_holder_distribution(analysis);

        // Compatibility
        Self::print_section("NTT Compatibility");
        Self::print_compatibility(&analysis.compatibility, analysis.token.decimals);

        // Risk score
        Self::print_section("Risk Score");
        Self::print_risk_score(analysis);

        // Verdict
        Self::print_verdict(analysis);

        // Next steps (only for compatible tokens)
        Self::print_next_steps(analysis);

        println!();
    }

    /// Print comparison table
    pub fn print_comparison(paths: &[MigrationPath]) {
        Self::print_header("Migration Path Comparison");

        for path in paths {
            Self::print_path(path);
            println!();
        }
    }

    fn print_header(title: &str) {
        println!();
        println!("{}", "═".repeat(60).bright_blue());
        println!("{}", title.bold());
        println!("{}", "═".repeat(60).bright_blue());
    }

    fn print_section(title: &str) {
        println!();
        println!("{}", format!("── {} ──", title).bright_white());
    }

    fn print_capability(name: &str, enabled: bool) {
        let status = if enabled {
            "Yes".green()
        } else {
            "No".dimmed()
        };
        println!("  {:<18} {}", name, status);
    }

    fn print_warning_item(name: &str, present: bool) {
        if present {
            println!("  {} {}", "⚠".yellow(), name.yellow());
        }
    }

    fn bool_colored(value: bool) -> colored::ColoredString {
        if value {
            "Yes".yellow()
        } else {
            "No".green()
        }
    }

    fn print_compatibility(compat: &CompatibilityResult, evm_decimals: u8) {
        let status = if compat.is_compatible {
            "Compatible".green().bold()
        } else {
            "Not Compatible".red().bold()
        };
        println!("  Status:     {}", status);
        println!("  Mode:       {}", compat.recommended_mode);

        if compat.decimal_trimming_required {
            println!(
                "  Decimals:   {} → {} {}",
                evm_decimals,
                compat.solana_decimals,
                "(trimming required)".yellow()
            );
        }

        if !compat.issues.is_empty() {
            println!();
            println!("  Issues:");
            for issue in &compat.issues {
                let severity = match issue.severity {
                    IssueSeverity::Info => "[INFO]".dimmed(),
                    IssueSeverity::Warning => "[WARN]".yellow(),
                    IssueSeverity::Error => "[ERROR]".red(),
                };
                println!("    {} {}", severity, issue.title);
            }
        }
    }

    fn print_risk_score(analysis: &FullAnalysis) {
        let score = &analysis.risk_score;
        let score_colored = match score.rating {
            RiskRating::Low => format!("{}/100", score.total).green(),
            RiskRating::Medium => format!("{}/100", score.total).yellow(),
            RiskRating::High => format!("{}/100", score.total).red(),
        };

        let rating_colored = match score.rating {
            RiskRating::Low => "Low Risk".green().bold(),
            RiskRating::Medium => "Medium Risk".yellow().bold(),
            RiskRating::High => "High Risk".red().bold(),
        };

        println!("  Score:  {} ({})", score_colored, rating_colored);
        println!();
        println!("  Components:");
        println!(
            "    Decimal handling:     {}/20",
            score.components.decimal_handling
        );
        println!(
            "    Token features:       {}/25",
            score.components.token_features
        );
        println!(
            "    Bytecode complexity:  {}/20",
            score.components.bytecode_complexity
        );
        println!(
            "    Holder concentration: {}/15",
            score.components.holder_concentration
        );
        println!(
            "    Bridge status:        {}/20",
            score.components.bridge_status
        );
    }

    fn print_verdict(analysis: &FullAnalysis) {
        println!();
        println!("{}", "═".repeat(60).bright_blue());

        if analysis.compatibility.is_compatible && analysis.risk_score.rating == RiskRating::Low {
            println!(
                "  {} {} ({}) is a strong candidate for NTT migration via Sunrise. Recommended mode: {}.",
                "✅".green(),
                analysis.token.symbol.bold(),
                analysis.token.name,
                analysis.compatibility.recommended_mode.to_string().green().bold(),
            );
        } else if analysis.compatibility.is_compatible {
            println!(
                "  {} {} ({}) is compatible with NTT migration (mode: {}), but has some risk factors to review.",
                "⚠️".yellow(),
                analysis.token.symbol.bold(),
                analysis.token.name,
                analysis.compatibility.recommended_mode.to_string().yellow().bold(),
            );
        } else {
            println!(
                "  {} {} ({}) has compatibility issues for NTT. Consider Neon EVM as an alternative.",
                "❌".red(),
                analysis.token.symbol.bold(),
                analysis.token.name,
            );
        }

        println!("{}", "═".repeat(60).bright_blue());
    }

    fn print_next_steps(analysis: &FullAnalysis) {
        if !analysis.compatibility.is_compatible {
            return;
        }
        println!();
        Self::print_section("Next Steps");
        println!(
            "  1. Generate migration report:  {}",
            format!(
                "daybreak report {} --chain {} -o ./output",
                analysis.token.address,
                analysis.token.chain.to_string().to_lowercase()
            )
            .cyan()
        );
        println!(
            "  2. Deploy SPL token on devnet: {}",
            format!(
                "daybreak deploy {} --chain {}",
                analysis.token.address,
                analysis.token.chain.to_string().to_lowercase()
            )
            .cyan()
        );
        println!(
            "  3. Apply for Sunrise listing:  {}",
            "https://www.sunrise.wtf".cyan()
        );
        println!();
        println!("  {}", "Powered by Wormhole NTT via Sunrise".dimmed());
    }

    fn print_holder_distribution(analysis: &FullAnalysis) {
        Self::print_section("Holder Distribution");
        match &analysis.holder_data {
            Some(data) => {
                println!(
                    "  Top-10 concentration: {:.1}%",
                    data.top_10_concentration
                );
                if let Some(total) = data.total_holders {
                    println!("  Total holders:       {}", total);
                }

                // Show top-5 holders
                if !data.top_holders.is_empty() {
                    println!();
                    let show = data.top_holders.len().min(5);
                    for (i, holder) in data.top_holders[..show].iter().enumerate() {
                        let addr = if holder.address.len() > 12 {
                            format!("{}...{}", &holder.address[..6], &holder.address[holder.address.len()-4..])
                        } else {
                            holder.address.clone()
                        };
                        println!(
                            "  {}. {} — {:.2}%",
                            i + 1,
                            addr.cyan(),
                            holder.percentage
                        );
                    }
                }

                // Concentration warning
                if let Some(top) = data.top_holders.first() {
                    if top.percentage > 50.0 {
                        println!();
                        println!(
                            "  {} Top holder controls {:.1}% of supply",
                            "⚠".yellow(),
                            top.percentage
                        );
                    }
                }
            }
            None => {
                println!(
                    "  {}",
                    "Unavailable (requires Etherscan API key via --etherscan-key)".dimmed()
                );
            }
        }
    }

    fn print_path(path: &MigrationPath) {
        let feasibility_colored = match path.feasibility {
            Feasibility::Recommended => "Recommended".green().bold(),
            Feasibility::Viable => "Viable".yellow(),
            Feasibility::NotRecommended => "Not Recommended".red(),
        };

        println!(
            "{} - {}",
            path.method.to_string().bold(),
            feasibility_colored
        );
        println!(
            "  Cost: {}  |  Time: {}",
            path.estimated_cost_usd, path.estimated_time
        );

        if !path.pros.is_empty() {
            println!("  {}", "Pros:".green());
            for pro in &path.pros {
                println!("    {} {}", "+".green(), pro);
            }
        }

        if !path.cons.is_empty() {
            println!("  {}", "Cons:".red());
            for con in &path.cons {
                println!("    {} {}", "-".red(), con);
            }
        }
    }
}
