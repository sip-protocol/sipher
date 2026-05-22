// packages/agent/src/utils/key-normalize.ts

/**
 * Normalize a hex-encoded key to the `0x`-prefixed lowercase form expected by
 * `@sip-protocol/sdk` (its `HexString` brand).
 *
 * Accepts input with or without a leading `0x`, in any letter case, and
 * validates the hex body — non-hex input is rejected rather than silently
 * handed to the SDK. Shared by the stealth/ECDH tools (claim today, send/swap
 * as they adopt it) that pass raw user-supplied keys into the SDK.
 *
 * @param key - hex string, with or without a `0x` prefix
 * @returns the key as `0x<lowercase-hex>`
 * @throws if the key (after stripping any `0x` prefix) is not non-empty hex
 */
export function normalizeKey(key: string): `0x${string}` {
  const stripped = key.startsWith('0x') ? key.slice(2) : key
  if (!/^[0-9a-fA-F]+$/.test(stripped)) {
    throw new Error('Key must be hex (with or without 0x prefix)')
  }
  return `0x${stripped.toLowerCase()}` as `0x${string}`
}
