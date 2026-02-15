#!/usr/bin/env bash
# Daybreak Demo Script — record with: asciinema rec demo.cast --command="bash demo.sh"
# NOTE: Uses public RPC endpoints with rate limits. Delays between commands are intentional.

DAYBREAK="./target/release/daybreak"

clear
echo ""
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║                                                          ║"
echo "  ║   Daybreak — EVM → Solana Migration Planning CLI         ║"
echo "  ║   Powered by Wormhole NTT (Sunrise)                      ║"
echo "  ║                                                          ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo ""
sleep 2

# Demo 1: Scan ONDO — not on Solana, strong migration candidate
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Demo 1: Scan a token — is ONDO ready for Solana?"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
sleep 1
echo "\$ daybreak scan 0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3 --chain ethereum"
sleep 1
$DAYBREAK scan 0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3 --chain ethereum
sleep 5

# Demo 2: Compare migration paths for ONDO
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Demo 2: Compare migration paths"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
sleep 1
echo "\$ daybreak compare 0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3 --chain ethereum"
sleep 1
$DAYBREAK compare 0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3 --chain ethereum
sleep 5

# Demo 3: Deploy SPL token on Solana devnet (the climax)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Demo 3: Deploy SPL token on Solana devnet"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
sleep 1
echo "\$ daybreak deploy 0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3 --chain ethereum --network devnet"
sleep 1
$DAYBREAK deploy 0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3 --chain ethereum --network devnet
sleep 3

# Close
echo ""
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║   Built for the Solana Graveyard Hackathon               ║"
echo "  ║   Sunrise Track — Wormhole NTT                           ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo ""
sleep 2
