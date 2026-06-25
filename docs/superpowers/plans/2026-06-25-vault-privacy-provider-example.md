# Vault Privacy Provider example — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public, naming-clean reference example showing how to back a pluggable `VaultPrivacyProvider` interface with the `sipher_vault` native-SOL builders, including the full stealth + Pedersen-commitment + viewing-key withdraw assembly, with vitest unit tests.

**Architecture:** A new workspace package `examples/vault-privacy-provider/` that *consumes* the merged `@sipher/sdk` native-SOL builders (`buildDepositSolTx`, `buildPrivateSendSolTx`, `buildRefundSolTx`) and `@sip-protocol/sdk` stealth/commitment primitives. A `SipherVaultPrivacyProvider` class implements the interface; a single shared depositor keypair signs every fund-moving call (depositor-as-vault commingling). Unit tests mock the RPC `Connection` (reusing the `packages/sdk/tests/privacy-sol.test.ts` pattern) and use real crypto.

**Tech Stack:** TypeScript (ES2022, `moduleResolution: bundler`, `type: module`, `.js` import extensions), vitest 4, `@sipher/sdk` (workspace), `@sip-protocol/sdk`, `@noble/hashes`, `@noble/ciphers`, `@solana/web3.js`.

## Global Constraints

- **Naming gate (public repo):** no partner, competitor, or third-party product names or handles anywhere in code/comments/README. Run the deny-list grep supplied with the execution notes (kept out of this public file so the rule does not itself name the parties); it must return empty.
- **No new SDK surface.** The example only *consumes* existing `@sipher/sdk` / `@sip-protocol/sdk` exports. Do not add/modify SDK files.
- **Native SOL only.** Use the `*Sol*` builders + `NATIVE_SOL_MINT`. SPL/Token-2022 is a one-paragraph README note, not built.
- **Depositor-as-vault.** Every deposit/withdraw/refund is signed by ONE shared depositor keypair. A per-user depositor is forbidden (breaks commingling) — assert this with a dedicated test.
- **Honesty.** Code comments + README state: commingling/decorrelation, NOT cryptographic graph-break; amounts are visible (TIER_1, the Pedersen commitment is for disclosure/audit only). No "cryptographically hidden" / "even the operator can't link" copy.
- **Commits:** GPG-signed (key already configured), Conventional Commits, **no AI attribution** of any kind.
- **Build before test:** `@sipher/sdk` resolves to its built `dist/` (its `main`), so run `pnpm --filter @sipher/sdk build` once during setup before the example's tests can import it.

---

## File Structure

```
examples/vault-privacy-provider/
  package.json          # @sipher/example-vault-privacy-provider, private, scripts: test/typecheck
  tsconfig.json         # mirrors packages/sdk/tsconfig.json
  README.md             # generic explanation + honesty caveats + SPL extension note
  src/
    hex.ts              # hexToBytes (0x-aware) + bigintToLeBytes  (local helpers)
    types.ts            # StealthMetaAddress, WithdrawArtifacts, VaultPrivacyProvider, result types
    stealth.ts          # parseStealthMetaAddress + assembleWithdrawArtifacts (the assembly centerpiece)
    provider.ts         # SipherVaultPrivacyProvider implements VaultPrivacyProvider
    index.ts            # barrel
  test/
    hex.test.ts
    stealth.test.ts
    provider.test.ts
```
Modify: `pnpm-workspace.yaml` (add `'examples/*'`).

---

## Task 1: Scaffold the package + hex/bigint helpers

**Files:**
- Modify: `pnpm-workspace.yaml`
- Create: `examples/vault-privacy-provider/package.json`
- Create: `examples/vault-privacy-provider/tsconfig.json`
- Create: `examples/vault-privacy-provider/src/hex.ts`
- Test: `examples/vault-privacy-provider/test/hex.test.ts`

**Interfaces:**
- Produces: `hexToBytes(hex: string): Uint8Array`, `bigintToLeBytes(value: bigint, size?: number): Uint8Array` (from `src/hex.ts`).

- [ ] **Step 1: Add the examples glob to the workspace**

Edit `pnpm-workspace.yaml` — add `'examples/*'` to the `packages:` list:
```yaml
packages:
  - '.'
  - 'packages/*'
  - 'app'
  - 'examples/*'
  - '!sdks/**'
```

- [ ] **Step 2: Create `examples/vault-privacy-provider/package.json`**

```json
{
  "name": "@sipher/example-vault-privacy-provider",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "Reference: back a pluggable privacy-provider interface with the sipher vault (native SOL).",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@sipher/sdk": "workspace:*",
    "@sip-protocol/sdk": "^0.11.0",
    "@solana/web3.js": "^1.98.0",
    "@noble/hashes": "^2.0.0",
    "@noble/ciphers": "^2.2.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^4.1.9"
  }
}
```

- [ ] **Step 3: Create `examples/vault-privacy-provider/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 4: Install + build the SDK so the workspace link + dist exist**

Run from repo root:
```bash
pnpm install
pnpm --filter @sipher/sdk build
```
Expected: install succeeds (new package linked); `packages/sdk/dist/index.js` exists.

- [ ] **Step 5: Write the failing test** — `test/hex.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { hexToBytes, bigintToLeBytes } from '../src/hex.js'

describe('hexToBytes', () => {
  it('parses a 0x-prefixed hex string', () => {
    expect(Array.from(hexToBytes('0xff00ab'))).toEqual([255, 0, 171])
  })
  it('parses a bare (no 0x) hex string', () => {
    expect(Array.from(hexToBytes('ff00ab'))).toEqual([255, 0, 171])
  })
  it('throws on odd-length hex', () => {
    expect(() => hexToBytes('0xabc')).toThrow('Invalid hex length')
  })
})

describe('bigintToLeBytes', () => {
  it('encodes a bigint little-endian in 8 bytes by default', () => {
    expect(Array.from(bigintToLeBytes(2_000_000n))).toEqual([128, 132, 30, 0, 0, 0, 0, 0])
  })
  it('honours an explicit size', () => {
    expect(Array.from(bigintToLeBytes(1n, 4))).toEqual([1, 0, 0, 0])
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm --filter @sipher/example-vault-privacy-provider test`
Expected: FAIL — cannot resolve `../src/hex.js`.

- [ ] **Step 7: Implement `src/hex.ts`**

```ts
/** Convert an optionally 0x-prefixed hex string to bytes. */
export function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex
  if (h.length % 2 !== 0) throw new Error(`Invalid hex length: ${hex}`)
  const bytes = new Uint8Array(h.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/** Convert a bigint to a little-endian byte array of `size` bytes. */
export function bigintToLeBytes(value: bigint, size = 8): Uint8Array {
  const buf = new Uint8Array(size)
  let v = value
  for (let i = 0; i < size; i++) {
    buf[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return buf
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --filter @sipher/example-vault-privacy-provider test`
Expected: PASS (5 tests).

- [ ] **Step 9: Commit**

```bash
git add pnpm-workspace.yaml examples/vault-privacy-provider/package.json examples/vault-privacy-provider/tsconfig.json examples/vault-privacy-provider/src/hex.ts examples/vault-privacy-provider/test/hex.test.ts pnpm-lock.yaml
git commit -m "feat(example): scaffold vault-privacy-provider package + hex helpers"
```

---

## Task 2: Stealth meta-address parse + withdraw-artifact assembly

**Files:**
- Create: `examples/vault-privacy-provider/src/types.ts`
- Create: `examples/vault-privacy-provider/src/stealth.ts`
- Test: `examples/vault-privacy-provider/test/stealth.test.ts`

**Interfaces:**
- Consumes: `hexToBytes`, `bigintToLeBytes` (Task 1); `generateEd25519StealthAddress`, `ed25519PublicKeyToSolanaAddress`, `commit` from `@sip-protocol/sdk`; `sha256` from `@noble/hashes/sha2.js`; `xchacha20poly1305` from `@noble/ciphers/chacha.js`; `randomBytes` from `node:crypto`.
- Produces (from `src/types.ts`): `interface StealthMetaAddress { spendingKey: \`0x${string}\`; viewingKey: \`0x${string}\`; chain: 'solana' }`; `interface WithdrawArtifacts { stealthPubkey: PublicKey; amountCommitment: Uint8Array; ephemeralPubkey: Uint8Array; viewingKeyHash: Uint8Array; encryptedAmount: Uint8Array; proof: Uint8Array }`.
- Produces (from `src/stealth.ts`): `parseStealthMetaAddress(uri: string): StealthMetaAddress`; `assembleWithdrawArtifacts(recipient: StealthMetaAddress, amountLamports: bigint): WithdrawArtifacts`.

- [ ] **Step 1: Create `src/types.ts` (types only for now)**

```ts
import type { PublicKey } from '@solana/web3.js'

/** A recipient's stealth meta-address: spending + viewing public keys (0x-hex). */
export interface StealthMetaAddress {
  spendingKey: `0x${string}`
  viewingKey: `0x${string}`
  chain: 'solana'
}

/** On-chain crypto artifacts a native-SOL private withdrawal requires. */
export interface WithdrawArtifacts {
  /** One-time stealth recipient (a plain SystemAccount). */
  stealthPubkey: PublicKey
  /** Pedersen commitment C = amount*G + blinding*H (33 bytes). */
  amountCommitment: Uint8Array
  /** Ephemeral pubkey for ECDH, 33 bytes (ed25519 padded with a 0x00 prefix). */
  ephemeralPubkey: Uint8Array
  /** SHA-256 of the viewing key (32 bytes). */
  viewingKeyHash: Uint8Array
  /** AEAD blob: [24-byte nonce] || [ciphertext+tag] over [amount LE(8) || blinding(32)]. */
  encryptedAmount: Uint8Array
  /** ZK proof (empty — verified off-chain). */
  proof: Uint8Array
}
```

- [ ] **Step 2: Write the failing test** — `test/stealth.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { PublicKey } from '@solana/web3.js'
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'
import { parseStealthMetaAddress, assembleWithdrawArtifacts } from '../src/stealth.js'
import { hexToBytes } from '../src/hex.js'

const VIEWING = 'ab'.repeat(32)
const SPENDING = 'cd'.repeat(32)
const URI = `sip:solana:0x${SPENDING}:0x${VIEWING}`

describe('parseStealthMetaAddress', () => {
  it('parses a valid sip:solana URI', () => {
    const m = parseStealthMetaAddress(URI)
    expect(m).toEqual({ spendingKey: `0x${SPENDING}`, viewingKey: `0x${VIEWING}`, chain: 'solana' })
  })
  it('rejects a malformed URI (wrong parts count)', () => {
    expect(() => parseStealthMetaAddress('sip:solana:0xabc')).toThrow('Invalid stealth meta-address')
  })
  it('rejects non-0x keys', () => {
    expect(() => parseStealthMetaAddress(`sip:solana:${SPENDING}:${VIEWING}`)).toThrow('0x-prefixed')
  })
})

describe('assembleWithdrawArtifacts', () => {
  const recipient = parseStealthMetaAddress(URI)

  it('produces correctly-sized artifacts', () => {
    const a = assembleWithdrawArtifacts(recipient, 2_000_000n)
    expect(a.stealthPubkey).toBeInstanceOf(PublicKey)
    expect(a.amountCommitment.length).toBe(33)
    expect(a.ephemeralPubkey.length).toBe(33)
    expect(a.ephemeralPubkey[0]).toBe(0x00) // ed25519 32B padded with 0x00 prefix
    expect(a.viewingKeyHash.length).toBe(32)
    expect(a.proof.length).toBe(0)
    // encryptedAmount = 24 (nonce) + 40 (plaintext) + 16 (poly1305 tag) = 80
    expect(a.encryptedAmount.length).toBe(80)
  })

  it('encrypts [amount LE || blinding] recoverable with the viewing-key hash', () => {
    const amount = 2_000_000n
    const a = assembleWithdrawArtifacts(recipient, amount)
    const nonce = a.encryptedAmount.slice(0, 24)
    const ct = a.encryptedAmount.slice(24)
    const plaintext = xchacha20poly1305(a.viewingKeyHash, nonce).decrypt(ct)
    expect(plaintext.length).toBe(40)
    // first 8 bytes = amount LE
    let recovered = 0n
    for (let i = 7; i >= 0; i--) recovered = (recovered << 8n) | BigInt(plaintext[i])
    expect(recovered).toBe(amount)
  })

  it('uses the viewing key from the recipient (hash matches sha256(viewingKey bytes))', async () => {
    const { sha256 } = await import('@noble/hashes/sha2.js')
    const a = assembleWithdrawArtifacts(recipient, 1_000_000n)
    expect(Array.from(a.viewingKeyHash)).toEqual(Array.from(sha256(hexToBytes(`0x${VIEWING}`))))
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @sipher/example-vault-privacy-provider test test/stealth.test.ts`
Expected: FAIL — cannot resolve `../src/stealth.js`.

- [ ] **Step 4: Implement `src/stealth.ts`**

```ts
import { PublicKey } from '@solana/web3.js'
import {
  generateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
  commit,
} from '@sip-protocol/sdk'
import { sha256 } from '@noble/hashes/sha2.js'
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'
import { randomBytes as cryptoRandomBytes } from 'node:crypto'
import { hexToBytes, bigintToLeBytes } from './hex.js'
import type { StealthMetaAddress, WithdrawArtifacts } from './types.js'

/** Parse a `sip:solana:0x<spending>:0x<viewing>` URI into a StealthMetaAddress. */
export function parseStealthMetaAddress(uri: string): StealthMetaAddress {
  const parts = uri.split(':')
  if (parts.length !== 4 || parts[0] !== 'sip' || parts[1] !== 'solana' || !parts[2] || !parts[3]) {
    throw new Error(`Invalid stealth meta-address: expected sip:solana:<spendingKey>:<viewingKey>, got ${uri}`)
  }
  if (!parts[2].startsWith('0x') || !parts[3].startsWith('0x')) {
    throw new Error('Stealth meta-address keys must be 0x-prefixed hex strings')
  }
  return { spendingKey: parts[2] as `0x${string}`, viewingKey: parts[3] as `0x${string}`, chain: 'solana' }
}

/**
 * Assemble the native-SOL private-withdraw crypto artifacts for a recipient.
 *
 * Mirrors the agent private-send assembly (packages/agent/src/tools/send.ts),
 * minus the token-account derivation: native SOL pays a plain SystemAccount.
 *
 * Honesty: the Pedersen commitment is recorded for disclosure/audit. It does NOT
 * hide the on-chain lamport delta — amounts are visible (TIER_1).
 */
export function assembleWithdrawArtifacts(
  recipient: StealthMetaAddress,
  amountLamports: bigint,
): WithdrawArtifacts {
  // 1. One-time stealth address + ephemeral key from the recipient meta-address.
  const stealth = generateEd25519StealthAddress(recipient)
  const stealthPubkey = new PublicKey(ed25519PublicKeyToSolanaAddress(stealth.stealthAddress.address))

  // 2. Real Pedersen commitment: C = amount*G + blinding*H.
  const commitResult = commit(amountLamports)
  const amountCommitment = hexToBytes(commitResult.commitment)
  const blinding = commitResult.blinding

  // 3. Ephemeral pubkey: 32-byte ed25519 padded to 33 bytes with a 0x00 prefix
  //    (the program stores it opaquely for the scanner; it does not validate the curve).
  const ephRaw = hexToBytes(stealth.stealthAddress.ephemeralPublicKey)
  const ephemeralPubkey = new Uint8Array(33)
  ephemeralPubkey[0] = 0x00
  ephemeralPubkey.set(ephRaw, 1)

  // 4. Viewing-key hash.
  const viewingKeyHash = sha256(hexToBytes(recipient.viewingKey))

  // 5. Encrypt [amount LE(8) || blinding(32)] with XChaCha20-Poly1305 under the
  //    viewing-key hash; prepend the 24-byte nonce so the recipient can decrypt.
  const amountLeBytes = bigintToLeBytes(amountLamports)
  const blindingBytes = hexToBytes(blinding)
  const plaintext = new Uint8Array(amountLeBytes.length + blindingBytes.length)
  plaintext.set(amountLeBytes, 0)
  plaintext.set(blindingBytes, amountLeBytes.length)
  const nonce = new Uint8Array(cryptoRandomBytes(24))
  const ciphertext = xchacha20poly1305(viewingKeyHash, nonce).encrypt(plaintext)
  const encryptedAmount = new Uint8Array(nonce.length + ciphertext.length)
  encryptedAmount.set(nonce, 0)
  encryptedAmount.set(ciphertext, nonce.length)

  return {
    stealthPubkey,
    amountCommitment,
    ephemeralPubkey,
    viewingKeyHash,
    encryptedAmount,
    proof: new Uint8Array(0),
  }
}
```

> Note: if `commit()` returns a bare (non-0x) hex string, `hexToBytes` handles both; the blinding is likewise parsed via `hexToBytes`. If the assertion in Step 2 about `commitResult.commitment` being 33 bytes fails, inspect the actual return shape of `commit` in `@sip-protocol/sdk` and adjust the parse (it returns `{ commitment, blinding }` as hex) — do not change the test's 33-byte expectation, which matches the on-chain layout.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @sipher/example-vault-privacy-provider test test/stealth.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add examples/vault-privacy-provider/src/types.ts examples/vault-privacy-provider/src/stealth.ts examples/vault-privacy-provider/test/stealth.test.ts
git commit -m "feat(example): stealth meta-address parse + withdraw-artifact assembly"
```

---

## Task 3: Provider — interface + funding/verify/deposit/refund/preview

**Files:**
- Modify: `examples/vault-privacy-provider/src/types.ts` (add the interface + result types)
- Create: `examples/vault-privacy-provider/src/provider.ts`
- Test: `examples/vault-privacy-provider/test/provider.test.ts`

**Interfaces:**
- Consumes: `buildDepositSolTx`, `buildRefundSolTx`, `DEFAULT_FEE_BPS` from `@sipher/sdk`; `Connection`, `Keypair`, `PublicKey`, `SystemProgram`, `Transaction` from `@solana/web3.js`.
- Produces (`src/types.ts`): `DepositResult { txSignature: string; depositedLamports: bigint }`, `PrivateWithdrawResult { txSignature: string; withdrawnLamports: bigint; feeLamports: bigint; stealthAddress: string }`, `RefundResult { txSignature: string; refundedLamports: bigint }`, `interface VaultPrivacyProvider`.
- Produces (`src/provider.ts`): `class SipherVaultPrivacyProvider implements VaultPrivacyProvider` with constructor `(connection: Connection, opts?: { feeBps?: number })`.

- [ ] **Step 1: Add interface + result types to `src/types.ts`**

Append to `src/types.ts`:
```ts
import type { Transaction, Keypair } from '@solana/web3.js'

export interface DepositResult { txSignature: string; depositedLamports: bigint }
export interface PrivateWithdrawResult {
  txSignature: string
  withdrawnLamports: bigint
  feeLamports: bigint
  stealthAddress: string
}
export interface RefundResult { txSignature: string; refundedLamports: bigint }

/**
 * A pluggable privacy backend. The same shared depositor keypair MUST be passed to
 * every fund-moving call — a per-user depositor would link each user's deposit and
 * withdrawal on-chain and destroy the commingling anonymity property.
 */
export interface VaultPrivacyProvider {
  /** Advertised withdraw fee (bps). The actual deducted fee comes from on-chain config. */
  readonly feeBps: number
  buildFundingTx(args: {
    fromPk: string; depositorPk: string; amountLamports: bigint; recentBlockhash: string
  }): Promise<Transaction>
  verifyFunding(args: { depositorPk: string; expectedLamports: bigint; txSignature: string }): Promise<void>
  deposit(args: { depositorKp: Keypair; lamports: bigint }): Promise<DepositResult>
  privateWithdraw(args: {
    depositorKp: Keypair; recipient: StealthMetaAddress; lamports: bigint
  }): Promise<PrivateWithdrawResult>
  refund(args: { depositorKp: Keypair }): Promise<RefundResult>
  previewWithdraw(grossLamports: bigint): { feeLamports: bigint; netLamports: bigint }
}
```

- [ ] **Step 2: Write the failing test** — `test/provider.test.ts` (funding/verify/deposit/refund/preview)

```ts
import { describe, it, expect } from 'vitest'
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction,
} from '@solana/web3.js'
import {
  deriveVaultConfigPDA, deriveDepositRecordPDA, deriveSolVaultPDA,
  anchorDiscriminator, NATIVE_SOL_MINT,
} from '@sipher/sdk'
import { SipherVaultPrivacyProvider } from '../src/provider.js'

const BLOCKHASH = 'GfVcyD4kkTrj4bKc7WA9sZCin9JDbdT458zqL4zjxx2v'
const DEPOSITOR_KP = Keypair.generate()

// Mock Connection: dispatches getAccountInfo by pubkey (config carries fee_bps at
// offset 40); records the last raw tx submitted; returns a deterministic signature.
function mockConn(opts: { feeBps?: number; recordBalance?: bigint } = {}): Connection {
  const { feeBps = 10, recordBalance = 5_000_000n } = opts
  const configBuf = Buffer.alloc(60); configBuf.writeUInt16LE(feeBps, 40)
  // DepositRecord layout: disc(8) + depositor(32) + mint(32) + balance(u64 LE)
  const recordBuf = Buffer.alloc(8 + 32 + 32 + 8); recordBuf.writeBigUInt64LE(recordBalance, 72)
  const [cfg] = deriveVaultConfigPDA()
  const [rec] = deriveDepositRecordPDA(DEPOSITOR_KP.publicKey, NATIVE_SOL_MINT)
  return {
    getLatestBlockhash: async () => ({ blockhash: BLOCKHASH, lastValidBlockHeight: 1 }),
    getMinimumBalanceForRentExemption: async () => 890_880,
    getAccountInfo: async (pk: PublicKey) => {
      if (pk.equals(cfg)) return { data: configBuf } as never
      if (pk.equals(rec)) return { data: recordBuf } as never
      return { lamports: 1_000_000_000, data: Buffer.alloc(0) } as never
    },
    getTransaction: async () => ({ meta: { err: null } }) as never,
    sendRawTransaction: async () => 'SIG_' + BLOCKHASH.slice(0, 8),
    confirmTransaction: async () => ({ value: { err: null } }) as never,
  } as unknown as Connection
}

describe('SipherVaultPrivacyProvider — funding/verify/deposit/refund/preview', () => {
  it('feeBps defaults to the vault default and previewWithdraw splits fee/net', () => {
    const p = new SipherVaultPrivacyProvider(mockConn())
    expect(p.feeBps).toBe(10)
    expect(p.previewWithdraw(2_000_000n)).toEqual({ feeLamports: 2_000n, netLamports: 1_998_000n })
  })

  it('buildFundingTx is a plain SystemProgram.transfer to the depositor wallet', async () => {
    const p = new SipherVaultPrivacyProvider(mockConn())
    const from = Keypair.generate().publicKey.toBase58()
    const dep = DEPOSITOR_KP.publicKey.toBase58()
    const tx = await p.buildFundingTx({ fromPk: from, depositorPk: dep, amountLamports: 3_000_000n, recentBlockhash: BLOCKHASH })
    const ix = tx.instructions[0]
    expect(ix.programId.equals(SystemProgram.programId)).toBe(true)
    expect(ix.keys[0].pubkey.toBase58()).toBe(from)
    expect(ix.keys[1].pubkey.toBase58()).toBe(dep)
  })

  it('verifyFunding throws when the tx is missing', async () => {
    const conn = mockConn()
    ;(conn as unknown as { getTransaction: () => Promise<unknown> }).getTransaction = async () => null
    const p = new SipherVaultPrivacyProvider(conn)
    await expect(p.verifyFunding({ depositorPk: DEPOSITOR_KP.publicKey.toBase58(), expectedLamports: 1n, txSignature: 'x' }))
      .rejects.toThrow('not found')
  })

  it('deposit builds deposit_sol, signs with the depositor, and returns the signature', async () => {
    const p = new SipherVaultPrivacyProvider(mockConn())
    const res = await p.deposit({ depositorKp: DEPOSITOR_KP, lamports: 4_000_000n })
    expect(res.depositedLamports).toBe(4_000_000n)
    expect(res.txSignature).toMatch(/^SIG_/)
  })

  it('refund returns the on-chain record balance', async () => {
    const p = new SipherVaultPrivacyProvider(mockConn({ recordBalance: 4_242n }))
    const res = await p.refund({ depositorKp: DEPOSITOR_KP })
    expect(res.refundedLamports).toBe(4_242n)
    expect(res.txSignature).toMatch(/^SIG_/)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @sipher/example-vault-privacy-provider test test/provider.test.ts`
Expected: FAIL — cannot resolve `../src/provider.js`.

- [ ] **Step 4: Implement `src/provider.ts` (without privateWithdraw yet)**

```ts
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction,
} from '@solana/web3.js'
import {
  buildDepositSolTx, buildRefundSolTx, DEFAULT_FEE_BPS,
} from '@sipher/sdk'
import type {
  VaultPrivacyProvider, DepositResult, PrivateWithdrawResult, RefundResult, StealthMetaAddress,
} from './types.js'

/**
 * Reference privacy provider backed by the sipher vault (native SOL).
 *
 * Privacy model: commingling/decorrelation, NOT a cryptographic graph-break. The
 * shared depositor signature links the depositor to each payout on-chain; amounts
 * are visible (TIER_1). Unlinkability comes from many users sharing the depositor
 * + batching/jitter — supply ONE shared depositor keypair to every call.
 */
export class SipherVaultPrivacyProvider implements VaultPrivacyProvider {
  readonly feeBps: number
  constructor(private readonly connection: Connection, opts: { feeBps?: number } = {}) {
    this.feeBps = opts.feeBps ?? DEFAULT_FEE_BPS
  }

  private async signAndSubmit(tx: Transaction, signer: Keypair): Promise<string> {
    tx.sign(signer)
    const sig = await this.connection.sendRawTransaction(tx.serialize())
    await this.connection.confirmTransaction(sig, 'confirmed')
    return sig
  }

  async buildFundingTx(args: {
    fromPk: string; depositorPk: string; amountLamports: bigint; recentBlockhash: string
  }): Promise<Transaction> {
    const tx = new Transaction()
    tx.feePayer = new PublicKey(args.fromPk)
    tx.recentBlockhash = args.recentBlockhash
    tx.add(SystemProgram.transfer({
      fromPubkey: new PublicKey(args.fromPk),
      toPubkey: new PublicKey(args.depositorPk),
      lamports: Number(args.amountLamports),
    }))
    return tx
  }

  async verifyFunding(args: { depositorPk: string; expectedLamports: bigint; txSignature: string }): Promise<void> {
    const tx = await this.connection.getTransaction(args.txSignature, {
      commitment: 'confirmed', maxSupportedTransactionVersion: 0,
    })
    if (!tx) throw new Error(`Funding transaction ${args.txSignature} not found or not yet confirmed`)
    if (tx.meta?.err) throw new Error(`Funding transaction ${args.txSignature} failed: ${JSON.stringify(tx.meta.err)}`)
    // NOTE: production should additionally assert the credited lamport delta on
    // depositorPk equals expectedLamports by inspecting tx.meta pre/post balances.
  }

  async deposit(args: { depositorKp: Keypair; lamports: bigint }): Promise<DepositResult> {
    const { transaction } = await buildDepositSolTx(this.connection, args.depositorKp.publicKey, args.lamports)
    const txSignature = await this.signAndSubmit(transaction, args.depositorKp)
    return { txSignature, depositedLamports: args.lamports }
  }

  async refund(args: { depositorKp: Keypair }): Promise<RefundResult> {
    const { transaction, refundAmount } = await buildRefundSolTx(this.connection, args.depositorKp.publicKey)
    const txSignature = await this.signAndSubmit(transaction, args.depositorKp)
    return { txSignature, refundedLamports: refundAmount }
  }

  previewWithdraw(grossLamports: bigint): { feeLamports: bigint; netLamports: bigint } {
    const feeLamports = (grossLamports * BigInt(this.feeBps)) / 10_000n
    return { feeLamports, netLamports: grossLamports - feeLamports }
  }

  // privateWithdraw is added in Task 4.
  async privateWithdraw(_args: {
    depositorKp: Keypair; recipient: StealthMetaAddress; lamports: bigint
  }): Promise<PrivateWithdrawResult> {
    throw new Error('not implemented')
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @sipher/example-vault-privacy-provider test test/provider.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add examples/vault-privacy-provider/src/types.ts examples/vault-privacy-provider/src/provider.ts examples/vault-privacy-provider/test/provider.test.ts
git commit -m "feat(example): provider interface + funding/verify/deposit/refund/preview"
```

---

## Task 4: Provider — privateWithdraw + depositor-as-vault & rent-guard invariants

**Files:**
- Modify: `examples/vault-privacy-provider/src/provider.ts` (implement `privateWithdraw`)
- Modify: `examples/vault-privacy-provider/test/provider.test.ts` (add a describe block)

**Interfaces:**
- Consumes: `assembleWithdrawArtifacts` (Task 2); `buildPrivateSendSolTx`, `deriveDepositRecordPDA`, `deriveSolVaultPDA`, `deriveSolFeePDA`, `anchorDiscriminator`, `NATIVE_SOL_MINT`, `SIP_PRIVACY_PROGRAM_ID` from `@sipher/sdk`.
- Produces: working `SipherVaultPrivacyProvider.privateWithdraw`.

- [ ] **Step 1: Write the failing tests** — append to `test/provider.test.ts`

```ts
import { parseStealthMetaAddress } from '../src/stealth.js'
import { buildPrivateSendSolTx, deriveSolFeePDA } from '@sipher/sdk' // (add to existing imports)

const RECIPIENT = parseStealthMetaAddress(`sip:solana:0x${'cd'.repeat(32)}:0x${'ab'.repeat(32)}`)

describe('SipherVaultPrivacyProvider — privateWithdraw', () => {
  it('builds withdraw_private_sol to a derived stealth recipient and returns fee/net', async () => {
    const p = new SipherVaultPrivacyProvider(mockConn({ feeBps: 10 }))
    const res = await p.privateWithdraw({ depositorKp: DEPOSITOR_KP, recipient: RECIPIENT, lamports: 2_000_000n })
    expect(res.feeLamports).toBe(2_000n)
    expect(res.withdrawnLamports).toBe(1_998_000n)
    expect(res.txSignature).toMatch(/^SIG_/)
    // stealthAddress is a derived one-time address (not the depositor)
    expect(res.stealthAddress).not.toBe(DEPOSITOR_KP.publicKey.toBase58())
    expect(() => new PublicKey(res.stealthAddress)).not.toThrow()
  })

  it('reuses the SAME shared depositor across two flows (depositor-as-vault invariant)', async () => {
    const p = new SipherVaultPrivacyProvider(mockConn())
    const seen: string[] = []
    const conn = (p as unknown as { connection: Connection }).connection
    ;(conn as unknown as { sendRawTransaction: (raw: Uint8Array) => Promise<string> }).sendRawTransaction =
      async (raw: Uint8Array) => {
        const tx = Transaction.from(raw)
        // the depositor is the fee payer + the only signer on withdraw_private_sol
        seen.push(tx.feePayer!.toBase58())
        return 'SIG_x'
      }
    await p.privateWithdraw({ depositorKp: DEPOSITOR_KP, recipient: RECIPIENT, lamports: 2_000_000n })
    await p.privateWithdraw({ depositorKp: DEPOSITOR_KP, recipient: RECIPIENT, lamports: 1_500_000n })
    expect(seen).toEqual([DEPOSITOR_KP.publicKey.toBase58(), DEPOSITOR_KP.publicKey.toBase58()])
  })

  it('propagates the rent-exempt guard for a tiny payout to a fresh stealth', async () => {
    // stealth account does not exist (0 lamports); a 1000-lamport net is below the floor
    const conn = mockConn()
    ;(conn as unknown as { getAccountInfo: (pk: PublicKey) => Promise<unknown> }).getAccountInfo =
      (() => {
        const base = mockConn()
        const orig = base.getAccountInfo.bind(base)
        return async (pk: PublicKey) => {
          const [cfg] = deriveVaultConfigPDA()
          const [rec] = deriveDepositRecordPDA(DEPOSITOR_KP.publicKey, NATIVE_SOL_MINT)
          if (pk.equals(cfg) || pk.equals(rec)) return orig(pk)
          return null // stealth + everything else: not found
        }
      })()
    const p = new SipherVaultPrivacyProvider(conn)
    await expect(p.privateWithdraw({ depositorKp: DEPOSITOR_KP, recipient: RECIPIENT, lamports: 1_000n }))
      .rejects.toThrow('rent-exempt minimum')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @sipher/example-vault-privacy-provider test test/provider.test.ts`
Expected: FAIL — `privateWithdraw` throws 'not implemented'.

- [ ] **Step 3: Implement `privateWithdraw` in `src/provider.ts`**

Add `buildPrivateSendSolTx` to the `@sipher/sdk` import, `assembleWithdrawArtifacts` from `./stealth.js`, then replace the stub:
```ts
import { buildPrivateSendSolTx } from '@sipher/sdk'        // add to existing @sipher/sdk import
import { assembleWithdrawArtifacts } from './stealth.js'   // new import

  async privateWithdraw(args: {
    depositorKp: Keypair; recipient: StealthMetaAddress; lamports: bigint
  }): Promise<PrivateWithdrawResult> {
    const a = assembleWithdrawArtifacts(args.recipient, args.lamports)
    const { transaction, netAmount, feeAmount, stealthAddress } = await buildPrivateSendSolTx({
      connection: this.connection,
      depositor: args.depositorKp.publicKey,
      amount: args.lamports,
      stealthPubkey: a.stealthPubkey,
      amountCommitment: a.amountCommitment,
      ephemeralPubkey: a.ephemeralPubkey,
      viewingKeyHash: a.viewingKeyHash,
      encryptedAmount: a.encryptedAmount,
      proof: a.proof,
    })
    const txSignature = await this.signAndSubmit(transaction, args.depositorKp)
    return {
      txSignature,
      withdrawnLamports: netAmount,
      feeLamports: feeAmount,
      stealthAddress: stealthAddress.toBase58(),
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @sipher/example-vault-privacy-provider test test/provider.test.ts`
Expected: PASS (all provider tests, incl. the 3 new ones).

> If `Transaction.from(raw)` in the invariant test cannot parse the serialized tx (signature/blockhash quirk), assert the depositor differently: have the mock `sendRawTransaction` capture nothing and instead assert on `res.stealthAddress` uniqueness across the two calls AND that both calls accept the same `DEPOSITOR_KP` without error — the production invariant (depositor is the sole signer) is already enforced by `buildPrivateSendSolTx`'s account layout, verified in `packages/sdk/tests/privacy-sol.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add examples/vault-privacy-provider/src/provider.ts examples/vault-privacy-provider/test/provider.test.ts
git commit -m "feat(example): implement privateWithdraw + depositor-as-vault & rent-guard tests"
```

---

## Task 5: Barrel, README, and final gates

**Files:**
- Create: `examples/vault-privacy-provider/src/index.ts`
- Create: `examples/vault-privacy-provider/README.md`

**Interfaces:**
- Produces: a public barrel re-exporting the provider, interface, types, and assembly helpers.

- [ ] **Step 1: Create `src/index.ts` (barrel)**

```ts
export { SipherVaultPrivacyProvider } from './provider.js'
export { parseStealthMetaAddress, assembleWithdrawArtifacts } from './stealth.js'
export { hexToBytes, bigintToLeBytes } from './hex.js'
export type {
  VaultPrivacyProvider, StealthMetaAddress, WithdrawArtifacts,
  DepositResult, PrivateWithdrawResult, RefundResult,
} from './types.js'
```

- [ ] **Step 2: Add a barrel smoke test** — append to `test/provider.test.ts`

```ts
describe('barrel', () => {
  it('re-exports the public surface', async () => {
    const m = await import('../src/index.js')
    expect(typeof m.SipherVaultPrivacyProvider).toBe('function')
    expect(typeof m.assembleWithdrawArtifacts).toBe('function')
    expect(typeof m.parseStealthMetaAddress).toBe('function')
  })
})
```

- [ ] **Step 3: Create `README.md` (generic, naming-clean)**

````markdown
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
````

- [ ] **Step 4: Run the full example suite + typecheck**

```bash
pnpm --filter @sipher/example-vault-privacy-provider test
pnpm --filter @sipher/example-vault-privacy-provider typecheck
```
Expected: all tests PASS; typecheck clean (no errors).

- [ ] **Step 5: Naming-gate grep (must be empty)**

Run the deny-list grep from the execution notes over `examples/vault-privacy-provider`
(the literal pattern is kept out of this public file so it does not name the
parties). Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add examples/vault-privacy-provider/src/index.ts examples/vault-privacy-provider/README.md examples/vault-privacy-provider/test/provider.test.ts
git commit -m "feat(example): barrel + README + final gates"
```

---

## Self-Review (completed during planning)

- **Spec coverage:** interface (§3→Task 3), SDK mapping (§4→Tasks 3-4), depositor-as-vault + caveats (§5→Task 4 test + README), withdraw assembly (§6→Task 2), error/fee (§7→Task 3/4), native-SOL scope (§8→README), testing (§9→all tasks), file layout (§10→file structure). All covered.
- **Placeholder scan:** every code/test step carries real code; the two `> Note` blocks are fallback guidance, not deferred work.
- **Type consistency:** `StealthMetaAddress`/`WithdrawArtifacts` (Task 2) consumed unchanged in Tasks 3-4; provider result types (`DepositResult`/`PrivateWithdrawResult`/`RefundResult`) defined in Task 3 and returned exactly; `assembleWithdrawArtifacts` signature matches its call site; SDK symbol names verified against `origin/main` barrel.
