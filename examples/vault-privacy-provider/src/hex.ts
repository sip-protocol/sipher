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
