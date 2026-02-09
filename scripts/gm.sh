#!/bin/bash

# ANSI colors and styles
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# Color cycling banner
print_banner() {
  local colors=("${CYAN}" "${BLUE}" "${PURPLE}" "${RED}" "${YELLOW}" "${GREEN}")

  for color in "${colors[@]}"; do
    clear
    echo ""
    echo -e "${CYAN}===============================================================================${RESET}"
    echo ""
    echo -e "  ${color}███████╗${RESET} ${color}██╗${RESET} ${color}██████╗${RESET}  ${color}██╗  ██╗${RESET} ${color}███████╗${RESET} ${color}██████╗${RESET}"
    echo -e "  ${color}██╔════╝${RESET} ${color}██║${RESET} ${color}██╔══██╗${RESET} ${color}██║  ██║${RESET} ${color}██╔════╝${RESET} ${color}██╔══██╗${RESET}"
    echo -e "  ${color}███████╗${RESET} ${color}██║${RESET} ${color}██████╔╝${RESET} ${color}███████║${RESET} ${color}█████╗${RESET}   ${color}██████╔╝${RESET}"
    echo -e "  ${color}╚════██║${RESET} ${color}██║${RESET} ${color}██╔═══╝${RESET}  ${color}██╔══██║${RESET} ${color}██╔══╝${RESET}   ${color}██╔══██╗${RESET}"
    echo -e "  ${color}███████║${RESET} ${color}██║${RESET} ${color}██║${RESET}      ${color}██║  ██║${RESET} ${color}███████╗${RESET} ${color}██║  ██║${RESET}"
    echo -e "  ${color}╚══════╝${RESET} ${color}╚═╝${RESET} ${color}╚═╝${RESET}      ${color}╚═╝  ╚═╝${RESET} ${color}╚══════╝${RESET} ${color}╚═╝  ╚═╝${RESET}"
    sleep 0.08
  done
}

clear
print_banner

# Final rainbow banner
clear
echo ""
echo -e "${CYAN}===============================================================================${RESET}"
echo ""
echo -e "  ${YELLOW}███████╗${RESET} ${GREEN}██╗${RESET} ${BLUE}██████╗${RESET}  ${PURPLE}██╗  ██╗${RESET} ${RED}███████╗${RESET} ${CYAN}██████╗${RESET}"
sleep 0.08
echo -e "  ${YELLOW}██╔════╝${RESET} ${GREEN}██║${RESET} ${BLUE}██╔══██╗${RESET} ${PURPLE}██║  ██║${RESET} ${RED}██╔════╝${RESET} ${CYAN}██╔══██╗${RESET}"
sleep 0.08
echo -e "  ${YELLOW}███████╗${RESET} ${GREEN}██║${RESET} ${BLUE}██████╔╝${RESET} ${PURPLE}███████║${RESET} ${RED}█████╗${RESET}   ${CYAN}██████╔╝${RESET}"
sleep 0.08
echo -e "  ${YELLOW}╚════██║${RESET} ${GREEN}██║${RESET} ${BLUE}██╔═══╝${RESET}  ${PURPLE}██╔══██║${RESET} ${RED}██╔══╝${RESET}   ${CYAN}██╔══██╗${RESET}"
sleep 0.08
echo -e "  ${YELLOW}███████║${RESET} ${GREEN}██║${RESET} ${BLUE}██║${RESET}      ${PURPLE}██║  ██║${RESET} ${RED}███████╗${RESET} ${CYAN}██║  ██║${RESET}"
sleep 0.08
echo -e "  ${YELLOW}╚══════╝${RESET} ${GREEN}╚═╝${RESET} ${BLUE}╚═╝${RESET}      ${PURPLE}╚═╝  ╚═╝${RESET} ${RED}╚══════╝${RESET} ${CYAN}╚═╝  ╚═╝${RESET}"
sleep 0.15
echo ""
echo -e "          ${BOLD}${WHITE}Privacy-as-a-Skill for Multi-Chain Agents${RESET}"
echo ""
echo -e "${CYAN}===============================================================================${RESET}"
echo ""
sleep 0.3

# Project identity
echo -e "  ${YELLOW}Bismillah${RESET} ${DIM}— Let's begin${RESET}"
echo ""
sleep 0.3

echo -e "  ${PURPLE}ON-CHAIN PROGRAM:${RESET}"
printf "     ${BOLD}S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at${RESET}\n"
printf "     ${DIM}Solana Mainnet-Beta${RESET}\n"
echo ""
sleep 0.2

echo -e "  ${CYAN}STATS:${RESET}"
sleep 0.1
printf "     ${GREEN}✓${RESET} Endpoints  : ${BOLD}71${RESET}\n"
sleep 0.05
printf "     ${GREEN}✓${RESET} Tests      : ${BOLD}573${RESET} ${DIM}(36 suites)${RESET}\n"
sleep 0.05
printf "     ${GREEN}✓${RESET} Chains     : ${BOLD}17${RESET} ${DIM}(6 families)${RESET}\n"
sleep 0.05
printf "     ${GREEN}✓${RESET} Client SDKs: ${BOLD}4${RESET}  ${DIM}(TypeScript, Python, Rust, Go)${RESET}\n"
sleep 0.05
printf "     ${GREEN}✓${RESET} Integrations: ${BOLD}Eliza Plugin${RESET} ${DIM}(5 privacy actions)${RESET}\n"
sleep 0.05
printf "     ${GREEN}✓${RESET} Jito Bundle : ${BOLD}Real Block Engine${RESET} ${DIM}(JSON-RPC integration)${RESET}\n"
sleep 0.05
printf "     ${GREEN}✓${RESET} Devnet Proof: ${BOLD}Real on-chain${RESET} ${DIM}(shielded transfer confirmed)${RESET}\n"
echo ""
sleep 0.2

echo -e "  ${BLUE}CRYPTOGRAPHY:${RESET}"
sleep 0.1
printf "     ${GREEN}✓${RESET} Ed25519 + secp256k1 stealth addresses\n"
sleep 0.05
printf "     ${GREEN}✓${RESET} Pedersen commitments (homomorphic)\n"
sleep 0.05
printf "     ${GREEN}✓${RESET} XChaCha20-Poly1305 encryption\n"
sleep 0.05
printf "     ${GREEN}✓${RESET} STARK range proofs (M31 limbs)\n"
sleep 0.05
printf "     ${GREEN}✓${RESET} BIP32 hierarchical key derivation\n"
echo ""
sleep 0.3

echo -e "${CYAN}===============================================================================${RESET}"
echo -e "  ${BOLD}${WHITE}DEMO RECORDING GUIDE${RESET} ${DIM}— Commands to show judges${RESET}"
echo -e "${CYAN}===============================================================================${RESET}"
echo ""
sleep 0.3

# ─── Section 1: Production API ───────────────────────────────────────────────
echo -e "  ${YELLOW}▸ SCENE 1: Production API (live at sipher.sip-protocol.org)${RESET}"
echo ""
sleep 0.1
echo -e "  ${WHITE}1a. API Overview${RESET}"
echo -e "     ${DIM}\$${RESET} ${GREEN}curl -s https://sipher.sip-protocol.org/ | jq '{name, tagline, stats, cryptography}'${RESET}"
echo ""
sleep 0.05
echo -e "  ${WHITE}1b. Swagger Docs (71 endpoints)${RESET}"
echo -e "     ${DIM}\$${RESET} ${GREEN}open https://sipher.sip-protocol.org/docs${RESET}"
echo ""
sleep 0.05
echo -e "  ${WHITE}1c. Live Crypto Demo (25 steps, real keys)${RESET}"
echo -e "     ${DIM}\$${RESET} ${GREEN}curl -s https://sipher.sip-protocol.org/v1/demo | jq '.data.summary'${RESET}"
echo ""
sleep 0.05
echo -e "  ${WHITE}1d. Error Catalog${RESET}"
echo -e "     ${DIM}\$${RESET} ${GREEN}curl -s https://sipher.sip-protocol.org/v1/errors | jq '.data.totalCodes'${RESET}"
echo ""
sleep 0.05
echo -e "  ${WHITE}1e. Auth Gating (rejects without API key)${RESET}"
echo -e "     ${DIM}\$${RESET} ${GREEN}curl -s https://sipher.sip-protocol.org/v1/stealth/generate -X POST | jq .${RESET}"
echo ""
sleep 0.3

# ─── Section 2: Real On-Chain Transfer ───────────────────────────────────────
echo -e "  ${YELLOW}▸ SCENE 2: Real Devnet Shielded Transfer (the money shot)${RESET}"
echo ""
sleep 0.1
echo -e "  ${WHITE}2a. Start server on devnet (separate terminal)${RESET}"
echo -e "     ${DIM}\$${RESET} ${GREEN}SOLANA_RPC_URL=https://api.devnet.solana.com pnpm dev${RESET}"
echo ""
sleep 0.05
echo -e "  ${WHITE}2b. Execute real transfer (0.01 SOL → stealth address)${RESET}"
echo -e "     ${DIM}\$${RESET} ${GREEN}pnpm devnet-demo${RESET}"
echo ""
sleep 0.05
echo -e "  ${WHITE}2c. Previous proof (already confirmed on-chain)${RESET}"
echo -e "     ${DIM}\$${RESET} ${GREEN}open \"https://solscan.io/tx/4FmLGsLkC5DYJojpQeSQoGMArsJonTEnx729gnFCeYEjFsr8Z46VrDzKQXLhFrpM9Uj6ezBtCQckU28odzvjvV4a?cluster=devnet\"${RESET}"
echo ""
sleep 0.3

# ─── Section 3: Jito Block Engine Integration ────────────────────────────────
echo -e "  ${YELLOW}▸ SCENE 3: Real Jito Block Engine Integration${RESET}"
echo ""
sleep 0.1
echo -e "  ${WHITE}3a. Show dual-mode provider (real when configured, mock fallback)${RESET}"
echo -e "     ${DIM}\$${RESET} ${GREEN}grep -A3 'isJitoLive' src/services/jito-provider.ts${RESET}"
echo ""
sleep 0.05
echo -e "  ${WHITE}3b. Submit bundle via API (mock mode)${RESET}"
echo -e "     ${DIM}\$${RESET} ${GREEN}curl -s http://localhost:5006/v1/jito/relay -X POST -H 'Content-Type: application/json' -d '{\"transactions\":[\"SGVsbG8=\"],\"tipLamports\":\"10000\"}' | jq .${RESET}"
echo ""
sleep 0.05
echo -e "  ${WHITE}3c. Real Jito JSON-RPC methods: sendBundle, getBundleStatuses, getInflightBundleStatuses${RESET}"
echo -e "     ${DIM}Set JITO_BLOCK_ENGINE_URL=https://mainnet.block-engine.jito.wtf/api/v1/bundles${RESET}"
echo ""
sleep 0.3

# ─── Section 4: Privacy Demo Agent ───────────────────────────────────────────
echo -e "  ${YELLOW}▸ SCENE 4: Privacy Demo Agent (20-step autonomous flow)${RESET}"
echo ""
sleep 0.1
echo -e "  ${WHITE}4a. Run full Alice→Bob privacy pipeline${RESET}"
echo -e "     ${DIM}\$${RESET} ${GREEN}npx tsx scripts/privacy-demo-agent.ts${RESET}"
echo -e "     ${DIM}Shows: stealth → shield → scan → claim → compliance → governance${RESET}"
echo ""
sleep 0.3

# ─── Section 4: Test Suite ───────────────────────────────────────────────────
echo -e "  ${YELLOW}▸ SCENE 5: Test Suite (573 tests)${RESET}"
echo ""
sleep 0.1
echo -e "  ${WHITE}5a. Run all tests${RESET}"
echo -e "     ${DIM}\$${RESET} ${GREEN}pnpm test -- --run${RESET}"
echo ""
sleep 0.3

# ─── Section 5: Client SDKs ─────────────────────────────────────────────────
echo -e "  ${YELLOW}▸ SCENE 6: Generated Client SDKs${RESET}"
echo ""
sleep 0.1
echo -e "  ${WHITE}6a. Show 4 SDKs (auto-generated from OpenAPI spec)${RESET}"
echo -e "     ${DIM}\$${RESET} ${GREEN}ls sdks/${RESET}"
echo -e "     ${DIM}TypeScript (fetch), Python (urllib3), Rust (reqwest), Go (net/http)${RESET}"
echo ""
sleep 0.05
echo -e "  ${WHITE}6b. OpenAPI spec export${RESET}"
echo -e "     ${DIM}\$${RESET} ${GREEN}pnpm openapi:export && cat dist/openapi.json | jq '.info'${RESET}"
echo ""
sleep 0.3

# ─── Section 6: Eliza Integration ────────────────────────────────────────────
echo -e "  ${YELLOW}▸ SCENE 7: Eliza Plugin Integration${RESET}"
echo ""
sleep 0.1
echo -e "  ${WHITE}7a. Show plugin structure (5 privacy actions)${RESET}"
echo -e "     ${DIM}\$${RESET} ${GREEN}ls integrations/eliza/src/actions/${RESET}"
echo -e "     ${DIM}stealthGenerate, transferShield, scanPayments, privacyScore, commitmentCreate${RESET}"
echo ""
sleep 0.05
echo -e "  ${WHITE}7b. Run plugin demo (no Eliza runtime needed)${RESET}"
echo -e "     ${DIM}\$${RESET} ${GREEN}npx tsx scripts/eliza-plugin-demo.ts${RESET}"
echo ""
sleep 0.3

# ─── Section 7: OpenClaw Skill ───────────────────────────────────────────────
echo -e "  ${YELLOW}▸ SCENE 8: OpenClaw Skill (agent-native interface)${RESET}"
echo ""
sleep 0.1
echo -e "  ${WHITE}8a. Skill file (any agent can discover capabilities)${RESET}"
echo -e "     ${DIM}\$${RESET} ${GREEN}curl -s https://sipher.sip-protocol.org/skill.md | head -30${RESET}"
echo ""
sleep 0.3

echo -e "${CYAN}===============================================================================${RESET}"
echo ""
echo -e "  ${BOLD}${GREEN}GM! ${RESET}${DIM}Let's demo some privacy.${RESET}"
echo ""
echo -e "  ${DIM}Recording tip: Run scenes 1-4 for a 90-second demo.${RESET}"
echo -e "  ${DIM}Full showcase (all 8 scenes): ~3 minutes.${RESET}"
echo ""
echo -e "${CYAN}===============================================================================${RESET}"
echo ""
