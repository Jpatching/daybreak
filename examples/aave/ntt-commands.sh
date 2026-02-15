# NTT Deployment Commands

# 1. Initialize project
ntt init

# 2. Add source chain (ethereum)
ntt add-chain ethereum --mode locking --token 0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9

# 3. Add destination chain (Solana)
ntt add-chain solana --mode burning --decimals 8

# 4. Deploy contracts
ntt deploy

# 5. Configure rate limits (adjust as needed)
ntt configure-limits --daily-limit 1000000