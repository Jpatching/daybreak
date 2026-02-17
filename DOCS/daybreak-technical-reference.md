# Daybreak — Technical Reference

## Wormhole NTT (Native Token Transfers) — How It Works

NTT is Wormhole's framework for transferring tokens across chains WITHOUT wrapped tokens. Tokens arrive natively on the destination chain.

### Two Deployment Modes

**1. Locking (Hub-and-Spoke)**
- Tokens are LOCKED on the source chain (hub)
- Equivalent tokens are MINTED on destination chains (spokes)
- Use when: the token already exists on the source chain and you want to preserve supply there
- The NTT Manager on the hub chain holds locked tokens like an escrow

**2. Burning (Burn-and-Mint)**
- Tokens are BURNED on the source chain
- Equivalent tokens are MINTED on the destination chain
- Use when: deploying a natively multichain token with distributed supply
- Requires the token to implement burn functionality (ERC-20 Burnable)

### CRITICAL: Mode Pairing Rule
If the NttManager on the source chain is LOCKING mode, the NttManager on the destination chain MUST be BURNING mode. Mismatched modes = transfers fail and funds may be lost.

### Decimal Trimming
- NTT encodes amounts as unsigned 64-bit integers
- Amounts are capped at TRIMMED_DECIMALS (default: 8)
- If source token has > 8 decimals, the excess is "dust" and is preserved (not destroyed)
- The payload includes: trimmed amount + the decimal count it's expressed in
- This decimal count = min(TRIMMED_DECIMALS, source decimals, destination decimals)

**Example:** Token with 18 decimals on Ethereum → NTT trims to 8 decimals for transfer → SPL token on Solana can use up to 9 decimals

### Key Components
- **NttManager:** Oversees transfers. One per token per chain. Handles locking/burning, rate limiting, peer registration.
- **Transceiver:** Handles cross-chain messaging. Sends/receives NTT transfers. Can be Wormhole-based or custom.
- **Global Accountant:** Ensures burned+transferred never exceeds minted. Maintains supply integrity.

### Rate Limiting
- Configurable per chain and per time period
- Applies to both outbound (sending) and inbound (receiving)
- Transfers exceeding limits are queued (if shouldQueue=true) or reverted
- Important for preventing abuse during initial deployment

### NTT Deployment Steps (what Daybreak should output)
1. Deploy SPL token on Solana (or verify existing)
2. Deploy NttManager on source chain (EVM)
3. Deploy NttManager on Solana
4. Deploy Transceiver contracts on both chains
5. Configure peer managers (bilateral via setPeer/set_peer)
6. Grant minting authority to NttManager on Solana
7. Configure rate limits
8. Test with small transfer
9. Register with Sunrise for day-one liquidity

### NTT CLI Commands Reference
```bash
# Install NTT CLI
git clone --branch 'v1.5.0+cli' --single-branch --depth 1 \
  https://github.com/wormhole-foundation/native-token-transfers.git
cd native-token-transfers && bun install

# Scaffold project
ntt init

# Add chains
ntt add-chain --chain ethereum --token <address> --mode locking
ntt add-chain --chain solana --token <address> --mode burning

# Deploy
ntt deploy

# The deployment.json file contains all configuration
```

### deployment.json Structure (what Daybreak generates)
```json
{
  "network": "mainnet",
  "chains": {
    "ethereum": {
      "token": "0x...",
      "mode": "locking",
      "nttManager": "",
      "transceiver": ""
    },
    "solana": {
      "token": "",
      "mode": "burning",
      "nttManager": "",
      "transceiver": ""
    }
  },
  "rateLimit": {
    "outbound": "1000000",
    "inbound": "1000000",
    "duration": "86400"
  }
}
```

---

## EVM Token Analysis — JSON-RPC Patterns

Daybreak uses raw JSON-RPC calls to analyse EVM tokens. No ethers-rs dependency needed for read-only operations.

### Standard ERC-20 Function Selectors

```
name()          → 0x06fdde03
symbol()        → 0x95d89b41
decimals()      → 0x313ce567
totalSupply()   → 0x18160ddd
balanceOf(addr) → 0x70a08231
```

### Detecting Token Properties

**Is it ERC-20 Burnable?**
Check for `burn(uint256)` function: selector `0x42966c68`
```json
{
  "method": "eth_call",
  "params": [{
    "to": "<token_address>",
    "data": "0x42966c68"
  }, "latest"]
}
```
If the call doesn't revert with "execution reverted" indicating no such function, the token likely supports burn.

**Is it Pausable?**
Check for `paused()` function: selector `0x5c975abb`

**Is it Fee-on-Transfer?**
This is harder to detect statically. Daybreak should flag tokens that override `_transfer()` or have custom transfer logic. For the hackathon, we can check for known patterns or flag it as "requires manual verification."

**Has Custom Transfer Logic?**
Check bytecode size — very large bytecodes may indicate custom logic. Also check for `transferFrom` success with expected amount vs actual received.

### JSON-RPC Call Format
```rust
// Generic eth_call
async fn eth_call(rpc_url: &str, to: &str, data: &str) -> Result<String> {
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "eth_call",
        "params": [{
            "to": to,
            "data": data
        }, "latest"],
        "id": 1
    });
    // POST to rpc_url, parse result
}
```

### Decoding ABI-Encoded Responses
- `name()` and `symbol()` return ABI-encoded strings (offset + length + data)
- `decimals()` returns a uint8 (padded to 32 bytes)
- `totalSupply()` returns a uint256 (32 bytes)

```rust
// Decode uint256 from hex
fn decode_uint256(hex: &str) -> U256 {
    // Strip 0x prefix, parse as big-endian hex
}

// Decode ABI string
fn decode_abi_string(hex: &str) -> String {
    // Skip 0x prefix
    // Bytes 0-32: offset (usually 0x20 = 32)
    // Bytes 32-64: string length
    // Bytes 64+: UTF-8 string data
}
```

### Public RPC Endpoints (Free Tier)
- Ethereum: `https://eth.llamarpc.com` or `https://rpc.ankr.com/eth`
- Polygon: `https://polygon-rpc.com`
- BSC: `https://bsc-dataseed.binance.org`
- Arbitrum: `https://arb1.arbitrum.io/rpc`
- Base: `https://mainnet.base.org`

---

## Solana-Side Checks

### Check if Token Already Exists on Solana
- Query Solana token registry / Jupiter token list API
- Check Wormhole Portal bridge attestations
- Query: `https://token.jup.ag/all` for known token list

### Rent Cost Estimation
```
Token Mint account: 82 bytes → ~0.00144 SOL rent-exempt
Token Account (ATA): 165 bytes → ~0.00203 SOL rent-exempt
NTT Manager PDA: varies → ~0.002-0.01 SOL
Transceiver account: varies → ~0.002-0.01 SOL

Total estimated deployment cost: ~0.05-0.1 SOL
```

### SPL Token Properties to Map
| ERC-20 Property | SPL Token Equivalent |
|----------------|---------------------|
| name | Metaplex metadata (off-chain or on-chain) |
| symbol | Metaplex metadata |
| decimals | Mint decimals (0-9 typical, max 9 for SPL) |
| totalSupply | Mint supply |
| owner | Mint authority |
| burnable | Mint has burn authority |
| pausable | Freeze authority on mint |

### Important: SPL Token Decimal Limit
SPL tokens support 0-9 decimals (not 18 like ERC-20). NTT handles trimming, but the report should clearly flag this:
- ERC-20 with 18 decimals → SPL with 9 decimals (common)
- ERC-20 with 6 decimals (USDC) → SPL with 6 decimals (direct mapping)
- ERC-20 with 8 decimals → SPL with 8 decimals (direct mapping)

---

## Compatibility Matrix

| Token Feature | NTT Compatible? | Notes |
|--------------|----------------|-------|
| Standard ERC-20 | ✅ Yes | Ideal case |
| ERC-20 Burnable | ✅ Yes | Enables burn-and-mint mode |
| Non-burnable ERC-20 | ✅ Yes | Must use locking mode |
| Fee-on-transfer | ⚠️ Caution | Amounts may not match expected |
| Rebasing token | ❌ No | Supply changes break NTT accounting |
| ERC-777 | ⚠️ Caution | Should work but not officially supported |
| Proxy/upgradeable | ✅ Yes | Works fine, note the implementation address |
| Pausable | ✅ Yes | Note: if paused, transfers will fail |
| >18 decimals | ❌ No | NTT uint64 with 8 decimal trim won't handle |
| Non-ERC-20 (ERC-721 etc.) | ❌ No | NTT only supports fungible tokens |

---

## Sunrise Integration Specifics

### What Sunrise Adds on Top of NTT
- Day-one liquidity on Solana DEXs (Jupiter integration)
- Canonical token representation (not another wrapped variant)
- Block explorer support (Orb) from launch
- Wallet recognition from day one

### Sunrise Registration Process (for the report)
1. Deploy NTT contracts (both chains)
2. Contact Sunrise team / apply at sunrisedefi.com/apply
3. Provide: token address, NTT manager addresses, expected volume
4. Sunrise configures Jupiter routing and liquidity bootstrapping
5. Token becomes tradeable on Solana DEXs

### Report Should Include
- Direct link to Sunrise application: https://www.sunrisedefi.com/apply
- NTT deployment checklist
- Estimated timeline: 1-2 weeks for NTT deployment + Sunrise registration
- Recommended initial rate limits based on token's daily volume
