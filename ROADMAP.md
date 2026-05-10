# Sipher Roadmap

> Privacy infrastructure for users and agents on Solana — wallet for humans, REST API for autonomous systems.

Sipher is the privacy layer between you and the blockchain. The wallet hides amounts, sender, and recipient. The REST API gives autonomous agents the same primitives. This roadmap covers both surfaces — what's live today, what ships next, and where Sipher is heading.

## Product roadmap

> What you can do with Sipher today, and what's coming next.

### Q2 2026 — Devnet beta (LIVE)

<img alt="Sipher Dashboard hero with Privacy Graph and Privacy Score" src="docs/assets/roadmap/dashboard.png" />

- ✅ Stealth-address vault on Solana devnet (`sipher_vault` program: `S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB`)
- ✅ Privacy score + viewing keys (selective disclosure for compliance)
- ✅ Multi-chain readiness — M18 testnets shipped (Sepolia, Arbitrum, Base, OP, Scroll, Linea, Mode)
- ✅ Glass-neon UI launch (Vercel-hosted, design system at `app/src/components/ui/`)
- ✅ Real Jupiter swaps with stealth output routing
- ✅ SENTINEL security layer (LLM risk analyst, advisory mode live)

### Q3 2026 — Path B activates (M19)

<img alt="Sipher Vault stealth address list" src="docs/assets/roadmap/vault-stealth-list.png" />

- 🎯 Mainnet vault deploy (`sipher_vault` → mainnet-beta with audited config)
- 🎯 Denominated note mixer — Path B, second privacy backend, NOT replacement (see note below)
- 🎯 Proof composition v1 (Halo2 + Kimchi research → SDK ProofProvider)
- 🎯 Real privacy graph backend (replaces stub; full stealth-tree derivation via viewing keys)

### Q4 2026 — Standard & ecosystem (M20-M21)

- 🎯 Multi-language SDK (Python + Rust clients auto-generated from OpenAPI spec)
- 🎯 SIP-EIP standard proposal (privacy primitives as EVM standard)
- 🎯 Industry working group (Solana, NEAR, Ethereum, Zcash, Mina foundations)

## Note on the denominated note mixer

(content lands in Task 4)

## Developer & integrator roadmap

> REST API + SDK + agent capabilities

### Q2 2026 — In progress

(content lands in Task 4)

### Q3 2026 — M19 (Path B activates)

(content lands in Task 4)

### Q4 2026 — M20-M21

(content lands in Task 4)

## Endgame vision

(content lands in Task 5)

---

(footer lands in Task 5)
