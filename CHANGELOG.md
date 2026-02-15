# Changelog

All notable changes to Daybreak will be documented in this file.

## [0.4.0] - 2026-02-15

### Added
- `check` command — pre-migration readiness checker verifying NTT CLI, Solana CLI, wallet balance, token compatibility
- Metaplex token metadata — `deploy` now creates on-chain metadata so tokens display name/symbol in wallets (Phantom, Solflare)
- Wormhole transceiver config in deployment.json (`transceivers` section with consistency level)
- GitHub Actions CI — cargo test + clippy + fmt on push/PR
- Expanded curated token list from 18 to 55 tokens (more migration candidates)

### Changed
- NTT mode logic — burning mode now requires burn capability (was `burn || mint`); mint-only tokens correctly get Locking mode
- deployment.json always includes rate limits (fallback defaults when no Etherscan key)
- Rate limit fallback now accounts for token decimals (was overflowing for 18-decimal tokens)
- ntt-commands.sh now includes shebang, set -e, and descriptive header
- README overhauled with ONDO hero example, "Why NTT?" section, prerequisites, full migration flow diagram, architecture section

### Fixed
- ONDO deployment.json incorrectly showed "burning" mode for source chain (should be "locking")
- Supply-based rate limit fallback overflowed u64 for 18-decimal tokens

## [0.3.0] - 2026-02-15

### Added
- Smart rate limit calculator — fetches 24h transfer volume from Etherscan and recommends NTT daily/per-tx limits based on actual on-chain activity
- Rate limit section in scan output, markdown reports, and deployment.json
- Mint authority transfer — `--transfer-authority` flag on `deploy` command to hand off mint to NTT manager
- Post-deploy instructions after `deploy` showing full NTT setup sequence (authority → init → add-chain → deploy → test)
- Authority transfer step in generated ntt-commands.sh
- Decimal dust explainer — worked example showing precision loss when trimming (e.g. 18 → 8 decimals)
- "Decimal Migration" section in markdown reports with dust calculation
- Rebasing token detection via bytecode selectors (stETH-style)
- Rebasing compatibility error with wrapping recommendation
- Holder distribution display in scan output and markdown reports
- Missing data transparency — surfaces when holder/volume data is unavailable

### Changed
- Rate limits in deployment.json and CLI commands now use calculated values instead of hardcoded 1,000,000
- Decimal risk scoring uses gradual scale instead of step function
- Missing holder data now adds 5-point unknown risk penalty (was 0)
- Single-holder >50% concentration flagged as maximum risk (15/15)

## [0.2.0] - 2026-02-15

### Added
- `list` command — discover migration-ready ERC-20 tokens with ranked table output
- `deploy` command — create SPL tokens on Solana devnet/mainnet matching EVM token specs
- Solana on-chain integration (solana-sdk, spl-token) for real token deployment
- Sunrise branding — "Next Steps" section in scan output with Sunrise links
- Pre-migration checklist in markdown reports
- Estimated costs table in migration reports (~0.5 SOL total)
- "Next Steps with Sunrise" section in reports linking to sunrise.wtf
- Example reports for ONDO and AAVE tokens (examples/ directory)
- Demo recording (demo.gif, demo.cast, demo.sh)
- RPC retry logic with exponential backoff (3 retries)

### Changed
- Switched default RPC from LlamaRPC to PublicNode (more reliable)
- Fixed hardcoded decimals bug in terminal output (now shows actual token decimals)
- Terminal verdict now shows actionable next steps for compatible tokens
- Markdown reports now include cost estimates, checklist, and Sunrise section

### Removed
- Unused `SolanaChecker` module (replaced by `deploy` command)
- Unused `CostEstimator` module (replaced by inline cost table in reports)
- Dead code: unused methods, structs, and imports across codebase

### Fixed
- All compiler warnings eliminated (was 16)
- All clippy warnings fixed (was 5)
- Identical if-else branches in NTT config generation
- Useless `format!()` wrapper in markdown output

## [0.1.0] - 2026-02-14

### Added
- Initial release with `scan`, `report`, and `compare` commands
- EVM bytecode analysis (proxy detection, selfdestruct, fee patterns)
- Token capability detection (mint, burn, pause, blacklist, permit)
- NTT compatibility checking with mode recommendation
- Risk scoring system (0-100 across 5 dimensions)
- Bridge detection (Jupiter, Wormhole, native Solana)
- Markdown report generation with deployment.json
- Multi-chain support (Ethereum, Polygon, BSC, Arbitrum, Base, Optimism, Avalanche)
