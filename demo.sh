#!/usr/bin/env bash
# Daybreak Demo — record with: asciinema rec demo.cast --command="bash demo.sh" --cols 90 --rows 40
# Convert to GIF: agg demo.cast demo.gif --theme dracula --speed 1.5 --cols 90 --rows 40

set -e
DAYBREAK="./target/release/daybreak"
ONDO="0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3"
STATUS_MINT="HohiMxPvqvVe8g4NgsNZwXJhKFjjbUR777dGLGU4Tm5"

# Colors
BLUE='\033[1;34m'
CYAN='\033[1;36m'
GREEN='\033[1;32m'
WHITE='\033[1;37m'
DIM='\033[0;37m'
BOLD='\033[1m'
RESET='\033[0m'

# Simulate typed commands
type_cmd() {
    printf "\n  ${GREEN}\$${RESET} "
    for (( i=0; i<${#1}; i++ )); do
        printf "%s" "${1:$i:1}"
        sleep 0.03
    done
    printf "\n"
    sleep 0.5
}

section() {
    printf "\n"
    printf "  ${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
    printf "  ${BOLD}  %s${RESET}\n" "$1"
    printf "  ${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
    sleep 1
}

pause() {
    sleep "${1:-3}"
}

clear
printf "\n\n"
printf "  ${BLUE}╔══════════════════════════════════════════════════════════════════════════════╗${RESET}\n"
printf "  ${BLUE}║${RESET}                                                                              ${BLUE}║${RESET}\n"
printf "  ${BLUE}║${RESET}   ${WHITE}██████╗  █████╗ ██╗   ██╗██████╗ ██████╗ ███████╗ █████╗ ██╗  ██╗${RESET}     ${BLUE}║${RESET}\n"
printf "  ${BLUE}║${RESET}   ${WHITE}██╔══██╗██╔══██╗╚██╗ ██╔╝██╔══██╗██╔══██╗██╔════╝██╔══██╗██║ ██╔╝${RESET}     ${BLUE}║${RESET}\n"
printf "  ${BLUE}║${RESET}   ${WHITE}██║  ██║███████║ ╚████╔╝ ██████╔╝██████╔╝█████╗  ███████║█████╔╝ ${RESET}     ${BLUE}║${RESET}\n"
printf "  ${BLUE}║${RESET}   ${WHITE}██║  ██║██╔══██║  ╚██╔╝  ██╔══██╗██╔══██╗██╔══╝  ██╔══██║██╔═██╗ ${RESET}     ${BLUE}║${RESET}\n"
printf "  ${BLUE}║${RESET}   ${WHITE}██████╔╝██║  ██║   ██║   ██████╔╝██║  ██║███████╗██║  ██║██║  ██╗${RESET}     ${BLUE}║${RESET}\n"
printf "  ${BLUE}║${RESET}   ${WHITE}╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝${RESET}     ${BLUE}║${RESET}\n"
printf "  ${BLUE}║${RESET}                                                                              ${BLUE}║${RESET}\n"
printf "  ${BLUE}║${RESET}   ${DIM}End-to-end EVM → Solana migration via Wormhole NTT (Sunrise)${RESET}            ${BLUE}║${RESET}\n"
printf "  ${BLUE}║${RESET}                                                                              ${BLUE}║${RESET}\n"
printf "  ${BLUE}╚══════════════════════════════════════════════════════════════════════════════╝${RESET}\n"
printf "\n"
sleep 3

# ── Demo 1: Scan ──
section "Demo 1: Analyze — Is ONDO ready for Solana?"
type_cmd "daybreak scan $ONDO --chain ethereum --skip-holders"
$DAYBREAK scan $ONDO --chain ethereum --skip-holders
pause 5

# ── Demo 2: Migrate ──
section "Demo 2: Migrate — One command to deploy the NTT bridge"
type_cmd "daybreak migrate $ONDO --chain ethereum --network devnet --skip-ntt"
$DAYBREAK migrate $ONDO --chain ethereum --network devnet --skip-ntt
pause 4

# ── Demo 3: Status ──
section "Demo 3: Monitor — Post-migration bridge health"
type_cmd "daybreak status $STATUS_MINT --network devnet"
$DAYBREAK status $STATUS_MINT --network devnet
pause 4

# ── Demo 4: List ──
section "Demo 4: Discover — Find migration candidates at scale"
type_cmd "daybreak list --limit 8"
$DAYBREAK list --limit 8
pause 4

# ── Close ──
printf "\n\n"
printf "  ${BLUE}╔══════════════════════════════════════════════════════════════════════════════╗${RESET}\n"
printf "  ${BLUE}║${RESET}                                                                              ${BLUE}║${RESET}\n"
printf "  ${BLUE}║${RESET}   ${GREEN}One command to migrate any EVM token to Solana via Sunrise.${RESET}               ${BLUE}║${RESET}\n"
printf "  ${BLUE}║${RESET}                                                                              ${BLUE}║${RESET}\n"
printf "  ${BLUE}║${RESET}   ${DIM}github.com/Jpatching/daybreak${RESET}                                              ${BLUE}║${RESET}\n"
printf "  ${BLUE}║${RESET}   ${DIM}Built for the Solana Graveyard Hackathon — Sunrise Track${RESET}                   ${BLUE}║${RESET}\n"
printf "  ${BLUE}║${RESET}                                                                              ${BLUE}║${RESET}\n"
printf "  ${BLUE}╚══════════════════════════════════════════════════════════════════════════════╝${RESET}\n"
printf "\n"
sleep 4
