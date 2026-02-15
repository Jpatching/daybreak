# NTT Deployment Commands

# 1. Initialize project
ntt init

# 2. Add source chain (ethereum)
ntt add-chain ethereum --mode burning --token 0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3

# 3. Add destination chain (Solana)
ntt add-chain solana --mode burning --decimals 8

# 4. Deploy contracts
ntt deploy

# 5. Configure rate limits (adjust as needed)
ntt configure-limits --daily-limit 1000000