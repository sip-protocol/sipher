# Vault Privacy Provider (reference example)

Back a pluggable **privacy-provider** interface with the `sipher_vault` program's
native-SOL operations. An application keeps its own "make this transfer private"
abstraction and swaps in the vault underneath.

## What it shows
- A neutral `VaultPrivacyProvider` interface (`buildFundingTx`, `verifyFunding`,
  `deposit`, `privateWithdraw`, `refund`, `previewWithdraw`).
- `SipherVaultPrivacyProvider`, backed entirely by `@sipher/sdk` native-SOL
  builders (`buildDepositSolTx`, `buildPrivateSendSolTx`, `buildRefundSolTx`).
- The full private-withdraw assembly: a one-time stealth address, a Pedersen
  commitment, and viewing-key encryption (via `@sip-protocol/sdk`) — the part you
  most need to see, because the SDK withdraw builder is intentionally low-level.

## Depositor-as-vault (read this)
Every deposit/withdraw/refund is signed by **one shared depositor wallet**, reused
across all users' flows. On-chain you see only `shared-depositor -> stealth_N`; the
user-to-recipient map lives in your own off-chain records. **Do not use a per-user
depositor** — it would link each user's deposit and withdrawal on-chain.

## Honest privacy model
- **Commingling / decorrelation, not a cryptographic graph-break.** The depositor
  signature links the shared depositor to each payout on-chain. Unlinkability comes
  from many users sharing the depositor plus batching/jitter — not zero-knowledge.
- **Amounts are visible.** The Pedersen commitment is recorded for
  disclosure/audit; the lamport delta is on-chain (TIER_1 in the SDK's privacy-tier
  model). Use the SDK's `assessFlowPrivacy` to score a flow honestly.
- **Rent-exempt guard.** A one-time stealth recipient is a plain system account;
  `buildPrivateSendSolTx` rejects a payout that would leave it below the
  rent-exempt minimum. Pre-fund the stealth (or fund it on the funding leg).

## Run the tests
```bash
pnpm --filter @sipher/sdk build          # the example imports the built SDK
pnpm --filter @sipher/example-vault-privacy-provider test
```

## SPL / Token-2022 extension
The vault also supports classic SPL and Token-2022. The analogous path swaps the
`*Sol*` builders for `buildDepositTx` / `buildPrivateSendTx` with a `mint` + token
program and derives the stealth recipient's associated token account — otherwise
the shape is identical.
