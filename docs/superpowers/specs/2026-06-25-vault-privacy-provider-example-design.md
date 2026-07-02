# Vault Privacy Provider — reference example (design)

**Date:** 2026-06-25
**Status:** Approved (design)
**Scope:** A public, reference example showing how to back a pluggable
"privacy provider" interface with the `sipher_vault` native-SOL operations,
consuming `@sipher/sdk` (+ `@sip-protocol/sdk` for stealth/commitment).

---

## 1. Motivation

SIP positions the vault as a **pluggable privacy backend** — an application keeps
its own abstraction for "make this transfer private" and swaps the implementation
underneath. Today there is no end-to-end reference that shows an integrator how to
satisfy such an abstraction with the vault's native-SOL instructions.

This example fills that gap. It is deliberately shaped as a small, neutral
`VaultPrivacyProvider` interface so that an integrator who already has a
privacy-provider abstraction can adopt the vault with a thin mapping layer rather
than rewriting their pipeline. It also serves as living documentation for the
native-SOL builders shipped in `@sipher/sdk` (`buildDepositSolTx`,
`buildPrivateSendSolTx`, `buildRefundSolTx`, …).

## 2. Goals / Non-goals

**Goals**
- A typed `VaultPrivacyProvider` interface + a `SipherVaultPrivacyProvider`
  implementation backed entirely by `@sipher/sdk` native-SOL builders.
- Demonstrate the **full private-withdraw assembly** (one-time stealth address +
  Pedersen commitment + viewing-key encryption) — the part integrators most need
  shown, because the SDK withdraw builder is intentionally low-level.
- Honest, in-code documentation of the **privacy model** (what it does and does
  not hide).
- Unit tests (mocked RPC, real crypto) asserting each method builds a well-formed
  instruction.

**Non-goals**
- No new SDK surface — the example only *consumes* existing exports.
- No devnet/mainnet execution — the program is already deployed and the builders
  are already SDK-tested; unit tests prove the mapping.
- Native SOL only (see §8). SPL / Token-2022 are a documented one-paragraph
  extension, not built.

## 3. The interface

```ts
export interface VaultPrivacyProvider {
  /** Protocol fee charged on a private withdrawal, in tenths of a basis point. */
  readonly feeTenthsBps: number

  /**
   * Build the unsigned funding transfer: the user's main wallet sends lamports
   * to the shared vault-depositor wallet. This is a plain SystemProgram transfer
   * and is NOT vault-specific — the vault takes over once funds land in the
   * depositor wallet.
   */
  buildFundingTx(args: {
    fromPk: string
    depositorPk: string
    amountLamports: bigint
    recentBlockhash: string
  }): Promise<Transaction>

  /** Confirm the funding transfer landed and credited the expected lamports. */
  verifyFunding(args: {
    depositorPk: string
    expectedLamports: bigint
    txSignature: string
  }): Promise<void>

  /** Deposit lamports from the shared depositor wallet into the vault. */
  deposit(args: {
    depositorKp: Keypair
    lamports: bigint
  }): Promise<{ txSignature: string; depositedLamports: bigint }>

  /**
   * Withdraw lamports from the vault to a one-time stealth recipient derived from
   * `recipient` (a stealth meta-address), with a Pedersen commitment + viewing-key
   * disclosure. The shared depositor signs.
   */
  privateWithdraw(args: {
    depositorKp: Keypair
    recipient: StealthMetaAddress
    lamports: bigint
  }): Promise<{ txSignature: string; withdrawnLamports: bigint; feeLamports: bigint }>

  /** Self-recover an un-withdrawn balance back to the depositor wallet. */
  refund(args: {
    depositorKp: Keypair
  }): Promise<{ txSignature: string; refundedLamports: bigint }>

  /** Preview the fee + net for a given gross withdrawal amount. */
  previewWithdraw(grossLamports: bigint): { feeLamports: bigint; netLamports: bigint }
}
```

`StealthMetaAddress` carries the recipient's spending + viewing public keys (the
input to one-time stealth derivation).

## 4. Mapping to the SDK

| Method | Backed by (`@sipher/sdk`) |
|---|---|
| `feeTenthsBps` | advertised/preview rate from the constructor (`opts.feeTenthsBps ?? DEFAULT_FEE_TENTHS_BPS`); the actual fee deducted is the on-chain-derived `feeAmount` returned by `buildPrivateSendSolTx` (surfaced as `PrivateWithdrawResult.feeLamports`) |
| `buildFundingTx` | `SystemProgram.transfer` (no SDK call) |
| `verifyFunding` | `connection.getTransaction` + lamport-delta check |
| `deposit` | `buildDepositSolTx(conn, depositorKp.publicKey, lamports)` → sign → send |
| `privateWithdraw` | assemble stealth artifacts → `buildPrivateSendSolTx({ … })` → sign → send |
| `refund` | `buildRefundSolTx(conn, depositorKp.publicKey)` → sign → send |
| `previewWithdraw` | `fee = gross * feeTenthsBps / 100_000`, `net = gross - fee` |

All builders return an unsigned `Transaction` (with blockhash + fee payer set); the
provider signs with `depositorKp` and submits. The depositor is the fee payer and
the only required signer on deposit/withdraw/refund.

The vault's native unit is tenths of a basis point (`feeTenthsBps`), one order of
magnitude finer than the whole-bps unit many integrator-side fee interfaces use. An
integrator whose interface uses whole-bps `feeBps` receives `feeTenthsBps / 10` at
the downstream port — the sole conversion, kept out of this repo.

## 5. Depositor-as-vault model (load-bearing)

The vault's `withdraw_private_sol` requires the **depositor** as signer
(`DepositRecord` is keyed by depositor; the withdrawal debits that record). For an
integrator the depositor **must be a single shared aggregating wallet**, reused
across many users' flows. The example demonstrates exactly this: one shared
`depositorKp` signs every deposit and every withdrawal, so on-chain the graph is
`shared-depositor → stealth_N`, and the user↔recipient mapping lives off-chain in
the integrator's own records.

**This is the non-negotiable usage rule** and the README states it plainly: a
per-user depositor would paint each user's `deposit → withdraw` link on-chain and
destroy the anonymity property. Unlinkability here comes from **commingling** (many
users sharing the depositor) **+ batching/jitter**, not from cryptography.

### Honesty caveats (surfaced in code + README)
- **Not a cryptographic graph-break.** The depositor signature links the shared
  depositor to each stealth payout on-chain. The crowd is the set of concurrent
  users behind the shared depositor — not a zero-knowledge nullifier set.
- **Amounts are not hidden.** The Pedersen commitment is recorded for
  disclosure/audit, but the lamport delta is visible on-chain (TIER_1 in the SDK's
  privacy-tier model). Amount-hiding is a future tier.
- A short pointer to the SDK's `assessFlowPrivacy` (flow-privacy score) and
  `PrivacyTier` fee model so consumers can compute an honest score for a flow.

## 6. The private-withdraw assembly (the centerpiece)

`buildPrivateSendSolTx` is low-level: it takes a pre-computed `stealthPubkey`,
`amountCommitment` (33B), `ephemeralPubkey` (33B), `viewingKeyHash` (32B),
`encryptedAmount`, and `proof`. The example shows the full assembly using
`@sip-protocol/sdk`:

1. Derive a **one-time stealth address** + ephemeral key from the recipient's
   stealth meta-address.
2. Compute the **Pedersen commitment** `C = amount·G + blinding·H` (33B compressed).
3. Compute the **viewing-key hash** and **encrypt the amount** under the viewing key.
4. Call `buildPrivateSendSolTx({ depositor, stealthPubkey, amount, amountCommitment,
   ephemeralPubkey, viewingKeyHash, encryptedAmount, proof })`.

This mirrors the **proven** assembly already used by the agent's private-send tool
(`packages/agent/src/tools/send.ts`) — `commit(amount)` for the Pedersen
commitment + blinding, `generateEd25519StealthAddress` for the stealth + ephemeral
key (ed25519 32B padded to 33B with a `0x00` prefix), `sha256(viewingKey)` for the
hash, and XChaCha20-Poly1305 over `[amount LE || blinding]` for `encryptedAmount`.
The native-SOL example drops the token-account derivation (a plain system account
receives lamports directly); the assembly is otherwise identical.

It also surfaces the builder's **rent-exempt guard**: the stealth recipient is a
plain system account, so a small payout to a never-funded stealth is rejected by
the runtime. The example documents pre-funding the stealth (or relying on the
relayer/funding leg to do so) and lets the builder's actionable error propagate.

> Note (out of scope, follow-on): this assembly is currently inline in the agent
> tool and would be duplicated here. Extracting it into a shared `@sipher/sdk`
> helper would DRY both call sites and give integrators a single high-level entry
> point — deferred to keep this example to "consume existing exports only".

## 7. Error / fee handling
- All builder throws (zero amount, no deposit record, rent-floor violation)
  propagate with their actionable messages — the example does not swallow them.
- `feeTenthsBps` reflects the **withdraw-only** fee semantics: `deposit` and `refund`
  move the full amount; only `privateWithdraw` deducts the fee. `previewWithdraw`
  mirrors the on-chain computation.

## 8. Scope / YAGNI
- **Native SOL only.** The vault also supports classic SPL + Token-2022, but the
  example stays SOL-focused for clarity. A closing README paragraph notes the SPL
  path (`buildDepositTx` / `buildPrivateSendTx` with a `mint` + token program) as
  the analogous extension.

## 9. Testing strategy
- **Vitest unit tests**, mocked `Connection` (RPC reads stubbed:
  `getLatestBlockhash`, `getAccountInfo`, `getMinimumBalanceForRentExemption`,
  `getTransaction`), **real crypto** (deterministic from seeded inputs).
- Per method, assert the built instruction: program ID, account metas
  (signer/writable flags in the documented order), instruction discriminator, and
  data layout (e.g. commitment length 33, the shared depositor present and signing
  on every fund-moving call).
- A focused test for the **depositor-as-vault invariant**: two distinct flows reuse
  the same depositor key.
- A focused test for the **rent-exempt guard** path (small payout to an unfunded
  stealth throws).

## 10. File layout (indicative)
```
examples/vault-privacy-provider/
  README.md          # generic explanation + honesty caveats + SPL extension note
  package.json       # depends on @sipher/sdk (workspace:*) + @sip-protocol/sdk
  src/
    provider.ts      # VaultPrivacyProvider interface + SipherVaultPrivacyProvider
    stealth.ts       # the withdraw-assembly helper (stealth + commitment + encrypt)
    types.ts         # StealthMetaAddress, result types
  test/
    provider.test.ts
```
Exact workspace wiring (pnpm-workspace.yaml entry, tsconfig) is an implementation
detail for the plan.
