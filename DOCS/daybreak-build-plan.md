# Daybreak — 13-Day Build Plan

## Overview
Solo build. Rust CLI. Ship by Feb 27, 2026.

---

## Day 1 (Feb 14) — Project Setup & CLI Skeleton

- [ ] `cargo init daybreak`
- [ ] Add dependencies to Cargo.toml: `clap`, `tokio`, `reqwest`, `serde`, `serde_json`, `colored`, `anyhow`
- [ ] Set up CLI with clap: three subcommands (`analyze`, `check`, `report`)
- [ ] Define argument structs: token address, chain, output format, output path
- [ ] Test: `daybreak --help` prints usage
- [ ] Set up GitHub repo, write initial README
- [ ] Register for hackathon at solanafoundation.typeform.com/graveyard-hack

**Deliverable:** CLI compiles and prints help text.

---

## Day 2 (Feb 15) — Core Types & EVM RPC Client

- [ ] Define core types in `types.rs`:
  - `TokenInfo` (name, symbol, decimals, total_supply, chain, address)
  - `TokenCapabilities` (is_burnable, is_pausable, has_fee_on_transfer)
  - `MigrationReport` (all report sections)
  - `CompatibilityResult` (compatible, warnings, blockers)
- [ ] Build EVM JSON-RPC client in `analyzer/evm.rs`:
  - Generic `eth_call` function
  - `get_token_info()` — calls name(), symbol(), decimals(), totalSupply()
  - ABI decoding: uint256, string, uint8
- [ ] Test with a known token (e.g., USDC on Ethereum: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`)

**Deliverable:** `daybreak analyze 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum` prints token info.

---

## Day 3 (Feb 16) — Token Capability Detection

- [ ] Implement capability checks in `analyzer/evm.rs`:
  - Check for `burn(uint256)` function selector
  - Check for `paused()` function selector
  - Check bytecode size (flag if unusually large)
  - Check for proxy pattern (check IMPLEMENTATION_SLOT)
- [ ] Implement `eth_getCode` to verify contract exists
- [ ] Add error handling: invalid address, contract not found, RPC timeout
- [ ] Support multiple chains: ethereum, polygon, bsc, arbitrum, base

**Deliverable:** `daybreak analyze` now shows token info + capabilities.

---

## Day 4 (Feb 17) — Solana-Side Checks

- [ ] Implement `analyzer/solana.rs`:
  - Check Jupiter token list API for existing token
  - Query Solana RPC for known mint addresses
  - Basic Wormhole attestation check
- [ ] Implement rent cost calculator:
  - Token mint: 82 bytes rent
  - ATA: 165 bytes rent
  - Estimate NTT manager PDA cost
- [ ] Connect Solana checks to the analyze command

**Deliverable:** Analyze command shows both EVM info AND Solana status.

---

## Day 5 (Feb 18) — Compatibility Engine

- [ ] Implement `analyzer/compatibility.rs`:
  - Run all checks and produce CompatibilityResult
  - Categories: ✅ Compatible, ⚠️ Compatible with warnings, ❌ Incompatible
  - Check list:
    - Standard ERC-20? 
    - Decimal handling (flag >8, note trimming)
    - Burnable? (affects mode recommendation)
    - Fee-on-transfer? (flag as blocker)
    - Rebasing? (flag as blocker)
    - Already on Solana? (flag as info)
- [ ] Wire up `daybreak check` subcommand
- [ ] Nice terminal output with colours (green/yellow/red)

**Deliverable:** `daybreak check 0x...` outputs clean compatibility report.

---

## Day 6 (Feb 19) — Migration Plan Generator

- [ ] Implement `report/migration_plan.rs`:
  - Generate step-by-step migration plan based on token properties
  - Mode recommendation (locking vs burning) with reasoning
  - Decimal mapping (ERC-20 decimals → SPL decimals)
  - Account structure diagram (text-based)
  - Timeline estimate
- [ ] Implement `report/ntt_config.rs`:
  - Generate deployment.json skeleton for NTT CLI
  - Generate NTT CLI commands (init, add-chain, deploy)
  - Rate limit recommendations based on total supply

**Deliverable:** Report generation works with hardcoded test data.

---

## Day 7 (Feb 20) — Cost Estimation & Full Report Assembly

- [ ] Implement `report/cost_estimate.rs`:
  - Solana rent costs for all accounts
  - Estimated transaction fees for deployment
  - EVM gas cost estimates for NTT contract deployment
  - Total cost in SOL + USD (fetch SOL price from API or hardcode)
- [ ] Wire everything together: analyze → check → report pipeline
- [ ] `daybreak report` now produces full terminal output

**Deliverable:** `daybreak report 0x...` produces complete migration report in terminal.

---

## Day 8 (Feb 21) — Markdown & JSON Output

- [ ] Implement `output/markdown.rs`:
  - Full migration report as clean markdown
  - Include all sections: summary, compatibility, plan, NTT config, costs
  - Include generated deployment.json inline
  - Include NTT CLI commands as code blocks
- [ ] Implement `output/json.rs`:
  - Machine-readable JSON export of all report data
- [ ] Wire up `--output` and `--format` flags
- [ ] Test: generate reports for 3-4 different tokens

**Deliverable:** `daybreak report 0x... --output report.md` creates a polished markdown file.

---

## Day 9 (Feb 22) — Polish & Edge Cases

- [ ] Test with edge case tokens:
  - USDC (6 decimals)
  - WBTC (8 decimals)
  - DAI (18 decimals)
  - A fee-on-transfer token
  - A proxy contract
- [ ] Improve error messages and help text
- [ ] Add `--verbose` flag for detailed output
- [ ] Add `--quiet` flag for CI/scripting use
- [ ] Handle network errors gracefully (retry logic, timeouts)

**Deliverable:** Tool handles all common token types without crashing.

---

## Day 10 (Feb 23) — Sunrise-Specific Features

- [ ] Add Sunrise application link and info to reports
- [ ] Add section: "Next Steps with Sunrise" including:
  - Link to sunrisedefi.com/apply
  - What info Sunrise needs from you
  - Expected timeline for listing
- [ ] Generate a migration checklist (checkbox-style in markdown)
- [ ] Add banner/branding: "Generated by Daybreak — Migration planning for Sunrise on Solana"

**Deliverable:** Reports are Sunrise-branded and actionable.

---

## Day 11 (Feb 24) — README, Docs & Example Reports

- [ ] Write comprehensive README.md:
  - What is Daybreak
  - Installation
  - Usage examples
  - Example output screenshots
  - Architecture overview
- [ ] Generate 3 example reports for different tokens
- [ ] Add CONTRIBUTING.md (shows this is meant to grow)
- [ ] Add LICENSE (MIT)
- [ ] Clean up code: comments, module docs, remove dead code

**Deliverable:** Repo is presentable and documented.

---

## Day 12 (Feb 25) — Demo Video & Testing

- [ ] Record 3-minute demo video:
  - "Hi, I'm J. I built Daybreak for the Solana Graveyard Hackathon."
  - Show the problem: "Migrating to Solana is confusing. Where do you start?"
  - Demo: analyze → check → report on a real token
  - Show the markdown output
  - "Daybreak gives you the complete migration plan for Sunrise/NTT"
- [ ] Final testing pass — run against 5+ tokens
- [ ] Fix any bugs found during video recording

**Deliverable:** Demo video recorded and edited.

---

## Day 13 (Feb 26-27) — Submit

- [ ] Final code cleanup
- [ ] Push all code to GitHub
- [ ] Submit to hackathon:
  - GitHub repo link
  - Demo video link
  - Short description
- [ ] Post on X about the submission (tag @Sunrise_DeFi, @solana, #GraveyardHack)
- [ ] Share in Sunrise Discord if they have one

**Deliverable:** Submitted.

---

## Risk Mitigation

**If behind schedule:**
- Days 1-7 are critical path. If Day 7 is done, you have a submittable project.
- Days 8-10 are polish. Skip JSON output if needed.
- Day 11 README can be minimal.
- Video can be simple screen recording with voiceover.

**If RPC calls are unreliable:**
- Cache token data locally after first fetch
- Include a `--cached` mode that works from saved data
- Bundle example data for demo purposes

**If a feature is too complex:**
- Hardcode reasonable defaults instead of computing dynamically
- Mark as "coming soon" in the report rather than shipping broken
- The compatibility check is the most impressive part — make sure that works perfectly

---

## Success Criteria

The submission wins if it demonstrates:
1. **Real utility** — a team could actually use this to plan a migration
2. **Sunrise integration** — clearly tied to the sponsor, not generic
3. **Technical quality** — clean Rust code, good error handling, well-structured
4. **Presentation** — clear video, good README, polished output
5. **Graveyard theme** — brings "dead" projects back to life by making migration easy
