use colored::Colorize;
use crate::types::{
    CompatibilityResult, Feasibility, FullAnalysis, IssueSeverity, MigrationPath, RiskRating,
};

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
            println!(
                "  {} Token already exists on Solana",
                "!".yellow().bold()
            );
            if let Some(ref addr) = analysis.bridge_status.solana_address {
                println!("  Solana Address: {}", addr.cyan());
            }
            if let Some(ref provider) = analysis.bridge_status.bridge_provider {
                println!("  Bridge: {}", provider);
            }
        } else {
            println!("  {} No existing Solana presence", "✓".green());
        }

        // Compatibility
        Self::print_section("NTT Compatibility");
        Self::print_compatibility(&analysis.compatibility);

        // Risk score
        Self::print_section("Risk Score");
        Self::print_risk_score(analysis);

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

    fn print_compatibility(compat: &CompatibilityResult) {
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
                18,
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
        println!("  Cost: {}  |  Time: {}", path.estimated_cost_usd, path.estimated_time);

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
