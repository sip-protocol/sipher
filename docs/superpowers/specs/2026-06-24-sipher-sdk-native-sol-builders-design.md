# Native-SOL Transaction Builders for `@sipher/sdk` — Design

- **Date:** 2026-06-24
- **Status:** Approved (design) — pending implementation plan
- **Scope:** `packages/sdk` (`@sipher/sdk`) — additive, non-breaking
- **Author:** SIPHER

---

## 1. Context & motivation

The `sipher_vault` Solana program is a **universal-asset** vault: it custodies classic
SPL tokens, Token-2022 tokens, **and native SOL**. The native-SOL support is a first-class
instruction set on-chain:

| Instruction | Purpose |
|---|---|
| `create_sol_vault` | One-time init of the singleton `SolVault` + `SolFee` PDAs |
| `deposit_sol` | Deposit native lamports into the shared vault |
| `withdraw_private_sol` | Withdraw lamports to a stealth recipient + emit the announcement |
| `refund_sol` | Depositor reclaims their own balance |
| `authority_refund_sol` | Authority reclaims an expired deposit on the depositor's behalf |
| `collect_fee_sol` | Authority sweeps accrued SOL fees |

`@sipher/sdk` today exposes builders for the **token** path only:
`buildDepositTx`, `buildPrivateSendTx`, `buildRefundTx`, `buildAuthorityRefundTx`,
`getVaultBalance`, `getVaultConfig`. Every token builder hardcodes `TOKEN_PROGRAM_ID`
and takes `tokenMint` / token-account arguments. **There is no way to drive the vault's
native-SOL instructions from the SDK** — a consumer that wants native-SOL custody must
hand-roll raw `TransactionInstruction`s (as the program's own devnet scripts do).

This design closes that gap: it adds native-SOL builders that mirror the existing token
builders one-for-one, so a consumer can deposit / withdraw / refund native SOL with the
same ergonomics it already has for SPL.

## 2. Goals / non-goals

**Goals**
- Expose typed, unsigned-transaction builders for `deposit_sol`, `withdraw_private_sol`,
  `refund_sol`, `authority_refund_sol`, and the PDA-derivation + sentinel-mint constants
  they need.
- Byte-for-byte parity with the on-chain account orders and instruction-data layouts.
- 100% reuse of the existing read path: native-SOL balances are read with the **existing**
  `getVaultBalance(connection, depositor, NATIVE_SOL_MINT)` — no new read function.
- Test the same cheap way the token builders are tested: pure unit tests that assert the
  built transaction's account ordering, signer/writable flags, and instruction bytes,
  cross-checked against a real on-chain PDA fixture. No bankrun, no live RPC.

**Non-goals**
- The `collect_fee_sol` builder (authority fee-sweep — operational, not part of the
  deposit→withdraw flow). Deferred.
- A native-SOL **gasless** cash-out path (the current relayer targets stealth-ATA SPL
  withdrawals; a SOL gasless path has its own rent-prefund requirement — separate work).
- Publishing `@sipher/sdk` to npm. Deferred to whenever a downstream package needs to
  `import` it; the builders land + are reviewed in-repo first.
- Any change to the `sipher_vault` program. The instructions already exist on-chain.

## 3. Approach

**Separate `*Sol` builder functions** mirroring the existing token builders.

Two alternatives were considered and rejected:
- **Unified `asset` discriminator** on the existing builders (`{kind:'sol'|'spl'}`): a
  breaking signature change, internal branching, and the account sets genuinely differ
  (the SOL path has no mint, no ATA, no token-program account, and the recipient is a
  plain system account). Lower clarity, higher risk to the working token path.
- **A stateful `VaultClient` class**: the SDK is functional/stateless (free functions
  returning unsigned transactions). A class breaks the paradigm; a consumer composes the
  free functions directly.

Separate `*Sol` functions match (a) the program's own design — native SOL is a distinct
instruction set, not a parameter on the token instructions — and (b) the SDK's existing
function-per-instruction shape. The change is purely additive: no existing export changes.

## 4. API surface

All builders return an **unsigned** `Transaction` with `feePayer` and `recentBlockhash`
set, exactly like the token builders. The caller signs.

### 4.1 `config.ts` additions

```ts
/** Native-SOL sentinel mint. The vault seeds the native-SOL DepositRecord with the
 *  all-zeros pubkey (on-chain: `Pubkey::new_from_array([0u8; 32])`). This is NOT wrapped
 *  SOL — `WSOL_MINT` (So111…112) is a real SPL mint used by the *token* path; the native
 *  path never wraps. Keep the two distinct. */
export const NATIVE_SOL_MINT = new PublicKey(new Uint8Array(32)) // 1111…1111 (all zeros)

/** SolVault PDA seed — singleton lamport-holding account. */
export const VAULT_SOL_SEED = Buffer.from('vault_sol')

/** SolFee PDA seed — singleton lamport fee sink. */
export const FEE_SOL_SEED = Buffer.from('fee_sol')
```

### 4.2 PDA derivation (`vault.ts`)

```ts
/** SolVault PDA — seeds [b"vault_sol"]. Singleton (no per-mint variant). */
export function deriveSolVaultPDA(programId = SIPHER_VAULT_PROGRAM_ID): [PublicKey, number]

/** SolFee PDA — seeds [b"fee_sol"]. Singleton. */
export function deriveSolFeePDA(programId = SIPHER_VAULT_PROGRAM_ID): [PublicKey, number]
```

The native-SOL `DepositRecord` PDA needs no new helper — it is the **existing**
`deriveDepositRecordPDA(depositor, NATIVE_SOL_MINT, programId)` (the program seeds it with
`[b"deposit_record", depositor, NATIVE_SOL_MINT]`).

### 4.3 `vault.ts` builders

#### `buildDepositSolTx(connection, depositor, amount, programId?) → SolDepositResult`

Instruction `deposit_sol`. Accounts (order = `DepositSol` context):

| # | Account | Signer | Writable | Derivation |
|---|---|---|---|---|
| 0 | config | – | ✓ | `[vault_config]` |
| 1 | deposit_record | – | ✓ | `[deposit_record, depositor, NATIVE_SOL_MINT]` |
| 2 | sol_vault | – | ✓ | `[vault_sol]` |
| 3 | depositor | ✓ | ✓ | (arg) |
| 4 | system_program | – | – | `SystemProgram.programId` |

Data: `disc("deposit_sol")` + `amount` (`u64` LE) = 16 bytes. Validates `amount > 0n`.

#### `buildRefundSolTx(connection, depositor, programId?) → SolRefundResult`

Instruction `refund_sol`. Pre-fetches the `DepositRecord` to compute `refundAmount`
(throws if no record / zero balance). Accounts (order = `RefundSol`):

| # | Account | Signer | Writable | Derivation |
|---|---|---|---|---|
| 0 | config | – | – | `[vault_config]` |
| 1 | deposit_record | – | ✓ | `[deposit_record, depositor, NATIVE_SOL_MINT]` |
| 2 | sol_vault | – | ✓ | `[vault_sol]` |
| 3 | depositor | ✓ | ✓ | (arg) |

Data: `disc("refund_sol")` only (8 bytes).

#### `buildAuthorityRefundSolTx(connection, authority, depositor, programId?) → SolRefundResult`

Instruction `authority_refund_sol`. Authority signs on the depositor's behalf; the
depositor is a **non-signer** `SystemAccount` lamport destination (the on-chain
`has_one = depositor` guarantees principal returns to the original depositor; the timeout
is still enforced on-chain). Accounts (order = `AuthorityRefundSol`):

| # | Account | Signer | Writable | Derivation |
|---|---|---|---|---|
| 0 | config | – | – | `[vault_config]` (`has_one = authority`) |
| 1 | deposit_record | – | ✓ | `[deposit_record, depositor, NATIVE_SOL_MINT]` |
| 2 | sol_vault | – | ✓ | `[vault_sol]` |
| 3 | depositor | – | ✓ | (arg) — non-signer |
| 4 | authority | ✓ | ✓ | (arg) |

Data: `disc("authority_refund_sol")` only (8 bytes).

#### `buildCreateSolVaultTx(payer, programId?) → Transaction` — optional / lowest priority

Instruction `create_sol_vault` (one-time, no args). Accounts: config(ro), sol_vault(init,mut),
sol_fee(init,mut), payer(signer,mut), system_program. Included for surface completeness so a
fresh deployment can be bootstrapped through the SDK rather than the standalone script; the
PDAs already exist on the current devnet deployment, so this is not on the critical path.

### 4.4 `privacy.ts` builder — `buildPrivateSendSolTx(params) → WithdrawResult`

Instruction `withdraw_private_sol`. Mirrors `buildPrivateSendTx` with every token account
replaced by the lamport equivalents: the source is `sol_vault`, the fee sink is `sol_fee`,
and the recipient is a **plain `SystemAccount`** — the raw stealth pubkey itself, with **no
ATA and no mint check**. The four `sip_privacy` CPI accounts + system program are identical
to the token context.

`PrivateSendSolParams` drops `tokenMint` and `stealthTokenAccount` from the token version;
the recipient is just `stealthPubkey` (used both as account #4 and inside the instruction
data). All other fields are unchanged: `amount`, `amountCommitment` (33), `ephemeralPubkey`
(33), `viewingKeyHash` (32), `encryptedAmount`, `proof`. The fee is read from `VaultConfig`
(`fee_bps` at offset 40, `u16` LE) exactly as the token builder does.

Accounts (order = `WithdrawPrivateSol` context):

| # | Account | Signer | Writable | Derivation |
|---|---|---|---|---|
| 0 | config | – | – | `[vault_config]` |
| 1 | deposit_record | – | ✓ | `[deposit_record, depositor, NATIVE_SOL_MINT]` |
| 2 | sol_vault | – | ✓ | `[vault_sol]` |
| 3 | sol_fee | – | ✓ | `[fee_sol]` |
| 4 | stealth | – | ✓ | `stealthPubkey` (SystemAccount) |
| 5 | depositor | ✓ | ✓ | (param) |
| 6 | sip_config | – | ✓ | `[config]` @ `SIP_PRIVACY_PROGRAM_ID` |
| 7 | sip_transfer_record | – | ✓ | `[transfer_record, depositor, total_transfers]` @ sip_privacy |
| 8 | sip_privacy_program | – | – | `SIP_PRIVACY_PROGRAM_ID` |
| 9 | system_program | – | – | `SystemProgram.programId` |

Data layout (identical to the token withdraw): `disc("withdraw_private_sol")` + `amount`
(`u64`) + `amount_commitment` (33) + `stealth_pubkey` (32) + `ephemeral_pubkey` (33) +
`viewing_key_hash` (32) + `encrypted_amount` (`u32` len + bytes) + `proof` (`u32` len + bytes).

The `sip_transfer_record` PDA is derived exactly as in `buildPrivateSendTx`: read
`total_transfers` from the live `sip_privacy` Config, then
`[b"transfer_record", depositor, total_transfers_le]`.

### 4.5 Reads — no new function

`getVaultBalance(connection, depositor, NATIVE_SOL_MINT)` already returns the native-SOL
balance: the `DepositRecord` struct is asset-agnostic and is seeded by the sentinel mint.
The design only documents this; it adds nothing.

### 4.6 Result types (`types.ts`)

`WithdrawResult` is reused as-is for `buildPrivateSendSolTx` — its fields
(`transaction`, `netAmount`, `feeAmount`, `stealthAddress`) are all asset-accurate.

The token `DepositResult` / `RefundResult` have token-specific field names
(`vaultTokenAddress`, `depositorTokenAddress`) that would be wrong for SOL, so two small,
honestly-named result types are added rather than overloading the token ones:

```ts
export interface SolDepositResult {
  transaction: Transaction
  depositRecordAddress: PublicKey
  solVaultAddress: PublicKey
  amount: bigint
}

export interface SolRefundResult {
  transaction: Transaction
  refundAmount: bigint
  /** The depositor's main (system) account receiving the lamports. */
  depositorAddress: PublicKey
}
```

## 5. The `NATIVE_SOL_MINT` sentinel — the one easy-to-miss detail

The native-SOL `DepositRecord` is seeded with the **all-zeros pubkey**, not wrapped-SOL.
A reader who assumes "SOL = `WSOL_MINT`" will derive the wrong `DepositRecord` PDA and the
builder will target a non-existent account. The constant is named, documented, and unit
tests assert it derives the correct (real, on-chain) PDA — see §8.

## 6. Rent-exempt floor on the stealth recipient — the SOL-specific safety wrinkle

`withdraw_private_sol` pays a **plain `SystemAccount`** (the stealth pubkey directly).
Solana **rejects** any transaction that leaves a touched account with a non-zero balance
below its rent-exempt minimum (~890,880 lamports for a 0-data account). So a small payout
to a **never-funded** stealth address fails at the runtime, not in the program. This is a
known scar (the SDK/relayer must pre-fund fresh stealth payouts).

**Resolution (decided): the builder throws a clear, actionable error by default.**

`buildPrivateSendSolTx` will, before constructing the transaction:
1. fetch the stealth account's current lamports (`getAccountInfo`, treat missing as `0`),
2. fetch the 0-data rent-exempt minimum (`getMinimumBalanceForRentExemption(0)`),
3. compute `net = amount - fee`,
4. if `currentLamports + net < rentExemptMin`, throw:

```
Stealth recipient <pubkey> would be left below the rent-exempt minimum
(needs >= <rentExemptMin> lamports after the payout; would have <current+net>).
Pre-fund the stealth account to at least <rentExemptMin> lamports before withdrawing.
```

The caller (the eventual integration adapter, or a relayer) decides how to satisfy the
floor — top up the stealth, or batch a funding transfer. The builder stays honest and does
not silently move extra lamports. (An opt-in auto-prefund flag was considered and
deliberately deferred — it needs a funding source and hides lamport movement.)

## 7. Error handling

Mirrors the existing builders' style — plain `Error` with a specific, actionable message
(the SDK does not use a typed error hierarchy). Validation, before building:
- `amount <= 0n` → "amount must be greater than zero" (all builders that take an amount).
- `amountCommitment.length !== 33`, `ephemeralPubkey.length !== 33`,
  `viewingKeyHash.length !== 32` → exact-byte-length errors (withdraw only; reuse the
  token builder's checks verbatim).
- refund builders: missing `DepositRecord` → "No deposit record found — nothing to refund";
  zero balance → "No balance to refund".
- withdraw: the rent-exempt guard in §6.

No silent failures; every error names the offending value.

## 8. Testing strategy

Pure-unit, mirroring `tests/vault.test.ts` and `tests/privacy.test.ts` (build the tx →
assert structure; mock `Connection`). New `tests/vault-sol.test.ts` plus native-SOL cases
appended to the privacy suite.

**PDA fixtures (real, on-chain — the strongest assertion):** the current devnet deployment
has `SolVault = 8ZG46epBDrRbZ2oDneuemmSuQNNG3R58LhFo8Do2p6sq` and
`SolFee = 519L2NQN16H1fnN9iPu2r2ipmjPj156yWMPQumw8PkZ4`. `deriveSolVaultPDA()` /
`deriveSolFeePDA()` must reproduce these exactly.

Per builder:
- **Discriminator parity:** `anchorDiscriminator("deposit_sol" | "withdraw_private_sol" |
  "refund_sol" | "authority_refund_sol")` equals the first 8 bytes of the built data.
- **Account order + flags:** assert the full `keys` array (pubkey, `isSigner`, `isWritable`)
  matches the program context tables in §4, index by index. This is the load-bearing test —
  a reordered or mis-flagged account is the most likely defect.
- **Instruction data:** byte-exact layout (offsets, LE encodings, vec length prefixes).
- **`deposit_record` seed:** derived with `NATIVE_SOL_MINT`, not `WSOL_MINT`.
- **`authority_refund_sol`:** depositor is **non-signer**, authority **signer** — explicit
  assertion (the most security-relevant flag).
- **withdraw fee:** computed from a mocked `VaultConfig` `fee_bps`; `netAmount`/`feeAmount`
  correct.
- **rent-exempt guard:** mock a fresh (0-lamport) stealth + a `net` below the rent floor →
  expect the throw; mock a pre-funded stealth → expect success.
- **feePayer / blockhash:** set correctly (depositor for deposit/refund/withdraw, authority
  for authority-refund, payer for create-sol-vault).

Connection mocking follows the existing suites: stub `getLatestBlockhash`,
`getAccountInfo` (config / deposit_record / sip_config / stealth), and
`getMinimumBalanceForRentExemption`.

## 9. Out of scope (explicit)

- `collect_fee_sol` builder (operational fee-sweep).
- Native-SOL gasless cash-out (relayer integration).
- Publishing `@sipher/sdk` to npm (deferred; needs its own access/README/changeset prep).
- Any downstream consumer/adapter that uses these builders (separate work).
- Any `sipher_vault` program change.

## 10. Decisions log

| # | Decision | Choice |
|---|---|---|
| D1 | API shape | Separate `*Sol` builders (mirror token builders + program design) |
| D2 | Rent-exempt floor on stealth recipient | Builder throws a clear error by default; caller pre-funds |
| D3 | Publish `@sipher/sdk` | Defer — builders + tests land in-repo this cycle |
| D4 | Result types | Reuse `WithdrawResult`; add `SolDepositResult` / `SolRefundResult` |
| D5 | Native-SOL balance reads | Reuse `getVaultBalance(…, NATIVE_SOL_MINT)` — no new fn |
| D6 | `create_sol_vault` builder | Include as optional/lowest-priority surface completeness |
